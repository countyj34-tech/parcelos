import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ParcelStatusCode } from "@/backend/database/types";
import { AppError } from "@/backend/errors/app-error";
import { ParcelRepository } from "@/backend/repositories/parcel.repository";
import {
  createParcelSchema,
  updateParcelStatusSchema,
  type CreateParcelDto,
  type UpdateParcelStatusDto,
} from "@/backend/validators/parcel.validator";
import { AuditService } from "@/backend/services/audit.service";

/** Valid forward transitions in the parcel workflow. */
const STATUS_TRANSITIONS: Record<ParcelStatusCode, ParcelStatusCode[]> = {
  waiting_for_dropoff: ["reception_verification", "cancelled"],
  reception_verification: ["awaiting_payment", "received", "cancelled"],
  awaiting_payment: ["label_printed", "cancelled"],
  label_printed: ["received", "cancelled"],
  received: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "at_destination_branch"],
  in_transit: ["at_destination_branch"],
  at_destination_branch: ["ready_for_collection"],
  ready_for_collection: ["collected", "returned"],
  collected: [],
  cancelled: [],
  returned: [],
};

export type ServiceContext = {
  userId: string;
  companyId: string;
  roleCode: string;
};

export class ParcelService {
  private readonly parcels: ParcelRepository;
  private readonly audit: AuditService;

  constructor(private readonly db: SupabaseClient<Database>) {
    this.parcels = new ParcelRepository(db);
    this.audit = new AuditService(db);
  }

  async create(ctx: ServiceContext, dto: CreateParcelDto, trackingNumber: string) {
    const parsed = createParcelSchema.parse(dto);

    const parcel = await this.parcels.create({
      company_id: ctx.companyId,
      tracking_number: trackingNumber,
      ...parsed,
      created_by: ctx.userId,
    });

    await this.audit.log({
      companyId: ctx.companyId,
      actorId: ctx.userId,
      action: "create",
      entityType: "parcel",
      entityId: parcel.id,
      description: `Parcel ${trackingNumber} created`,
    });

    return parcel;
  }

  async transitionStatus(ctx: ServiceContext, parcelId: string, dto: UpdateParcelStatusDto) {
    const parsed = updateParcelStatusSchema.parse(dto);
    const parcel = await this.parcels.findById(ctx.companyId, parcelId);

    const allowed = STATUS_TRANSITIONS[parcel.status] ?? [];
    if (!allowed.includes(parsed.status)) {
      throw AppError.validation(`Cannot transition from ${parcel.status} to ${parsed.status}`);
    }

    const updated = await this.parcels.updateStatus(
      ctx.companyId,
      parcelId,
      parsed.status,
      ctx.userId,
      parsed.branch_id,
    );

    await this.audit.log({
      companyId: ctx.companyId,
      actorId: ctx.userId,
      action: "update",
      entityType: "parcel",
      entityId: parcelId,
      description: `Parcel status: ${parcel.status} → ${parsed.status}`,
      metadata: { from: parcel.status, to: parsed.status },
    });

    return updated;
  }

  async getByTracking(ctx: ServiceContext, trackingNumber: string) {
    const parcel = await this.parcels.findByTracking(ctx.companyId, trackingNumber);
    if (!parcel) throw AppError.notFound("Parcel", trackingNumber);
    return parcel;
  }
}

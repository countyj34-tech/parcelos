import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database, Parcel, ParcelStatusCode } from "@/backend/database/types";
import { BaseRepository, type PaginatedResult, type PaginationParams } from "@/backend/repositories/base.repository";

export type ParcelFilters = {
  status?: ParcelStatusCode;
  originBranchId?: string;
  destinationBranchId?: string;
  search?: string;
};

export type CreateParcelInput = {
  company_id: string;
  tracking_number: string;
  sender_name: string;
  sender_phone: string;
  sender_email?: string | null;
  sender_customer_id?: string | null;
  receiver_name: string;
  receiver_phone: string;
  receiver_email?: string | null;
  receiver_id?: string | null;
  origin_branch_id: string;
  destination_branch_id: string;
  category_id?: string | null;
  weight_kg?: number | null;
  declared_value_cents?: number;
  shipping_amount_cents: number;
  currency_code: string;
  description?: string | null;
  created_by?: string | null;
};

export class ParcelRepository extends BaseRepository {
  constructor(db: SupabaseClient<Database>) {
    super(db);
  }

  async findById(companyId: string, parcelId: string): Promise<Parcel> {
    const result = await this.db
      .from("parcels")
      .select("*")
      .eq("id", parcelId)
      .eq("company_id", companyId)
      .eq("soft_delete", false)
      .single();

    return this.assertNoError(result);
  }

  async findByTracking(companyId: string, trackingNumber: string): Promise<Parcel | null> {
    const result = await this.db
      .from("parcels")
      .select("*")
      .eq("company_id", companyId)
      .eq("tracking_number", trackingNumber)
      .eq("soft_delete", false)
      .maybeSingle();

    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async list(
    companyId: string,
    filters: ParcelFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Parcel>> {
    const page = Math.max(1, pagination.page ?? 1);
    const pageSize = Math.min(100, pagination.pageSize ?? 25);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.db
      .from("parcels")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .eq("soft_delete", false)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.originBranchId) query = query.eq("origin_branch_id", filters.originBranchId);
    if (filters.destinationBranchId) query = query.eq("destination_branch_id", filters.destinationBranchId);
    if (filters.search) {
      query = query.or(
        `tracking_number.ilike.%${filters.search}%,sender_name.ilike.%${filters.search}%,receiver_name.ilike.%${filters.search}%`,
      );
    }

    const result = await query;
    if (result.error) throw new Error(result.error.message);

    return this.paginate(result.data ?? [], result.count ?? 0, { page, pageSize });
  }

  async create(input: CreateParcelInput): Promise<Parcel> {
    const result = await this.db
      .from("parcels")
      .insert({
        ...input,
        status: "waiting_for_dropoff",
        payment_status: "unpaid",
        current_branch_id: input.origin_branch_id,
      })
      .select("*")
      .single();

    return this.assertNoError(result);
  }

  async updateStatus(
    companyId: string,
    parcelId: string,
    status: ParcelStatusCode,
    updatedBy: string,
    branchId?: string,
  ): Promise<Parcel> {
    const timestamps: Partial<Parcel> = { updated_by: updatedBy };
    if (status === "received") timestamps.received_at = new Date().toISOString();
    if (status === "dispatched") timestamps.dispatched_at = new Date().toISOString();
    if (status === "ready_for_collection") timestamps.ready_at = new Date().toISOString();
    if (status === "collected") timestamps.collected_at = new Date().toISOString();

    const result = await this.db
      .from("parcels")
      .update({
        status,
        ...(branchId ? { current_branch_id: branchId } : {}),
        ...timestamps,
      })
      .eq("id", parcelId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    return this.assertNoError(result);
  }

  async softDelete(companyId: string, parcelId: string, updatedBy: string): Promise<void> {
    const result = await this.db
      .from("parcels")
      .update({ soft_delete: true, updated_by: updatedBy })
      .eq("id", parcelId)
      .eq("company_id", companyId);

    if (result.error) throw new Error(result.error.message);
  }
}

export class CompanyRepository extends BaseRepository {
  constructor(db: SupabaseClient<Database>) {
    super(db);
  }

  async findById(companyId: string): Promise<Company> {
    const result = await this.db
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .eq("soft_delete", false)
      .single();

    return this.assertNoError(result);
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const result = await this.db
      .from("companies")
      .select("*")
      .eq("slug", slug)
      .eq("soft_delete", false)
      .maybeSingle();

    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  async updateStatus(
    companyId: string,
    status: Company["status"],
    updatedBy: string,
  ): Promise<Company> {
    const result = await this.db
      .from("companies")
      .update({ status, updated_by: updatedBy })
      .eq("id", companyId)
      .select("*")
      .single();

    return this.assertNoError(result);
  }
}

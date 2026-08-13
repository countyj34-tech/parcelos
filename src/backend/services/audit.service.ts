import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditAction, Database } from "@/backend/database/types";

export type AuditLogInput = {
  companyId: string | null;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
};

/**
 * Centralized audit logging — every important action flows through here.
 */
export class AuditService {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async log(input: AuditLogInput): Promise<void> {
    const { error } = await this.db.from("audit_logs").insert({
      company_id: input.companyId,
      actor_id: input.actorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      description: input.description,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error("[AuditService] Failed to write audit log:", error.message);
    }
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SubscriptionStatus } from "@/backend/database/types";
import { AuditService } from "@/backend/services/audit.service";

export type SubscriptionCheck = {
  isValid: boolean;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  planCode: string | null;
};

/**
 * Subscription lifecycle — trial expiry, renewals, upgrades/downgrades.
 */
export class SubscriptionService {
  private readonly audit: AuditService;

  constructor(private readonly db: SupabaseClient<Database>) {
    this.audit = new AuditService(db);
  }

  async validateCompanySubscription(companyId: string): Promise<SubscriptionCheck> {
    const { data: sub } = await this.db
      .from("subscriptions")
      .select("status, trial_ends_at, subscription_plans(code)")
      .eq("company_id", companyId)
      .in("status", ["trialing", "active", "past_due"])
      .eq("soft_delete", false)
      .maybeSingle();

    if (!sub) return { isValid: false, status: null, trialEndsAt: null, planCode: null };

    const plan = sub.subscription_plans as { code: string } | null;
    const trialExpired =
      sub.status === "trialing" &&
      sub.trial_ends_at &&
      new Date(sub.trial_ends_at) < new Date();

    return {
      isValid: !trialExpired && sub.status !== "past_due",
      status: sub.status,
      trialEndsAt: sub.trial_ends_at,
      planCode: plan?.code ?? null,
    };
  }

  async expireTrials(actorId: string): Promise<number> {
    const now = new Date().toISOString();

    const { data: expired } = await this.db
      .from("subscriptions")
      .select("id, company_id")
      .eq("status", "trialing")
      .lt("trial_ends_at", now)
      .eq("soft_delete", false);

    if (!expired?.length) return 0;

    for (const sub of expired) {
      await this.db.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
      await this.db.from("companies").update({ status: "expired" }).eq("id", sub.company_id);

      await this.audit.log({
        companyId: sub.company_id,
        actorId,
        action: "update",
        entityType: "subscription",
        entityId: sub.id,
        description: "Trial expired — company marked expired",
      });
    }

    return expired.length;
  }

  async upgradePlan(
    companyId: string,
    newPlanCode: string,
    actorId: string,
  ): Promise<void> {
    const { data: plan } = await this.db
      .from("subscription_plans")
      .select("id")
      .eq("code", newPlanCode)
      .single();

    if (!plan) throw new Error(`Plan not found: ${newPlanCode}`);

    const { data: sub } = await this.db
      .from("subscriptions")
      .select("id, plan_id")
      .eq("company_id", companyId)
      .in("status", ["trialing", "active"])
      .single();

    if (!sub) throw new Error("No active subscription");

    await this.db.from("subscriptions").update({ plan_id: plan.id, updated_by: actorId }).eq("id", sub.id);

    await this.audit.log({
      companyId,
      actorId,
      action: "upgrade",
      entityType: "subscription",
      entityId: sub.id,
      description: `Plan upgraded to ${newPlanCode}`,
    });
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyStatus, Database } from "@/backend/database/types";
import { AppError } from "@/backend/errors/app-error";
import { CompanyRepository } from "@/backend/repositories/parcel.repository";
import { AuditService } from "@/backend/services/audit.service";
import type { CreateCompanyDto } from "@/backend/validators/parcel.validator";
import { createCompanySchema } from "@/backend/validators/parcel.validator";

export type PlatformContext = {
  userId: string;
  isPlatformOwner: boolean;
};

/**
 * Platform-level company lifecycle management.
 * Uses service role client — only callable from trusted server/edge context.
 */
export class CompanyService {
  private readonly companies: CompanyRepository;
  private readonly audit: AuditService;

  constructor(private readonly db: SupabaseClient<Database>) {
    this.companies = new CompanyRepository(db);
    this.audit = new AuditService(db);
  }

  async suspend(ctx: PlatformContext, companyId: string, reason: string) {
    if (!ctx.isPlatformOwner) throw AppError.forbidden("Platform owner access required");

    const company = await this.companies.updateStatus(companyId, "suspended", ctx.userId);

    await this.audit.log({
      companyId,
      actorId: ctx.userId,
      action: "suspend",
      entityType: "company",
      entityId: companyId,
      description: `Company suspended: ${reason}`,
    });

    return company;
  }

  async reactivate(ctx: PlatformContext, companyId: string) {
    if (!ctx.isPlatformOwner) throw AppError.forbidden("Platform owner access required");

    const company = await this.companies.updateStatus(companyId, "active", ctx.userId);

    await this.audit.log({
      companyId,
      actorId: ctx.userId,
      action: "reactivate",
      entityType: "company",
      entityId: companyId,
      description: "Company reactivated",
    });

    return company;
  }

  async setStatus(ctx: PlatformContext, companyId: string, status: CompanyStatus) {
    if (!ctx.isPlatformOwner) throw AppError.forbidden("Platform owner access required");
    return this.companies.updateStatus(companyId, status, ctx.userId);
  }

  /** Provisions a new courier company with trial subscription. */
  async createCompany(ctx: PlatformContext, dto: CreateCompanyDto) {
    if (!ctx.isPlatformOwner) throw AppError.forbidden("Platform owner access required");
    const input = createCompanySchema.parse(dto);

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + input.trial_days);

    const { data: company, error: companyError } = await this.db
      .from("companies")
      .insert({
        name: input.name,
        code: input.code,
        slug: input.slug,
        country_code: input.country_code,
        currency_code: input.currency_code,
        phone: input.phone,
        email: input.email,
        website: input.website,
        subdomain: input.subdomain,
        default_language: input.default_language,
        timezone: input.timezone,
        status: "trial",
        trial_ends_at: trialEnds.toISOString(),
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (companyError) throw AppError.validation(companyError.message);

    const { data: plan } = await this.db
      .from("subscription_plans")
      .select("id")
      .eq("code", input.plan_code)
      .single();

    if (plan) {
      await this.db.from("subscriptions").insert({
        company_id: company.id,
        plan_id: plan.id,
        status: "trialing",
        trial_ends_at: trialEnds.toISOString(),
        current_period_end: trialEnds.toISOString(),
        created_by: ctx.userId,
      });
    }

    await this.db.from("company_settings").insert({ company_id: company.id, created_by: ctx.userId });
    await this.db.from("domains").insert({
      company_id: company.id,
      hostname: input.subdomain,
      domain_type: "subdomain",
      is_primary: true,
      ssl_status: "active",
      verified: true,
      created_by: ctx.userId,
    });

    await this.audit.log({
      companyId: company.id,
      actorId: ctx.userId,
      action: "create",
      entityType: "company",
      entityId: company.id,
      description: `Company ${input.name} provisioned`,
    });

    return company;
  }
}

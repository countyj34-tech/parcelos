import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/backend/database/types";
import { AppError } from "@/backend/errors/app-error";

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Base repository — enforces tenant isolation at the data access layer.
 * Never pass company_id from user input without validation in the service layer.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: SupabaseClient<Database>) {}

  protected paginate<T>(items: T[], total: number, params: PaginationParams): PaginatedResult<T> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  protected assertNoError<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
    if (result.error) {
      throw new AppError("INTERNAL_ERROR", result.error.message, 500, { code: result.error.code });
    }
    if (result.data === null) {
      throw AppError.notFound("Resource");
    }
    return result.data;
  }

  /** Validates that a record belongs to the expected tenant. */
  protected assertTenantMatch(recordCompanyId: string, expectedCompanyId: string): void {
    if (recordCompanyId !== expectedCompanyId) {
      throw AppError.tenantIsolation();
    }
  }
}

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlatformCompany,
  fetchPlatformCompanies,
  fetchPlatformOverview,
  type CreateCompanyInput,
} from "@/lib/api/companies";
import { findCompanyIdBySlug, deleteCompanyRemote, setCompanyLifecycleRemote } from "@/lib/api/tenant";
import { fetchConsoleBundle } from "@/lib/api/platform-console";
import type { PlatformCompany } from "@/lib/platform-data";
import {
  setCompanyLifecycleStatus,
  softDeleteCompany,
  subscribeCompanyLifecycle,
  type LifecycleStatus,
} from "@/lib/company-lifecycle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toast } from "sonner";

export function usePlatformCompanies() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["platform", "companies"],
    queryFn: fetchPlatformCompanies,
    staleTime: 5_000,
  });

  useEffect(() => {
    return subscribeCompanyLifecycle(() => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
    });
  }, [queryClient]);

  return query;
}

export function usePlatformOverviewStats() {
  return useQuery({
    queryKey: ["platform", "overview"],
    queryFn: fetchPlatformOverview,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function usePlatformConsoleBundle() {
  return useQuery({
    queryKey: ["platform", "bundle"],
    queryFn: fetchConsoleBundle,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createPlatformCompany(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
    },
  });
}

async function applyLifecycle(
  slug: string,
  status: LifecycleStatus,
  reason: string,
  companies?: PlatformCompany[],
) {
  if (isSupabaseConfigured()) {
    const cachedId = companies?.find((c) => c.slug === slug)?.id;
    const id =
      cachedId && cachedId.length > 20 ? cachedId : await findCompanyIdBySlug(slug);
    if (!id) {
      toast.error("Company not found in database");
      return false;
    }
    const result = await setCompanyLifecycleRemote(id, status, reason);
    if (!result.ok) {
      toast.error(result.error ?? "Could not update company status");
      return false;
    }
    // Keep local override in sync so UI updates immediately
    setCompanyLifecycleStatus(slug, status, reason);
    return true;
  }

  setCompanyLifecycleStatus(slug, status, reason);
  return true;
}

export function useCompanyLifecycleActions() {
  const queryClient = useQueryClient();

  const bump = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
    void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
    void queryClient.invalidateQueries({ queryKey: ["platform", "bundle"] });
  };

  const companies = () => queryClient.getQueryData<PlatformCompany[]>(["platform", "companies"]);

  return {
    pause: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Paused", "Paused by platform owner", companies());
      if (ok) bump();
      return ok;
    },
    suspend: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Suspended", "Suspended for non-payment", companies());
      if (ok) bump();
      return ok;
    },
    disconnect: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Disconnected", "Disconnected by platform owner", companies());
      if (ok) bump();
      return ok;
    },
    reactivate: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Active", "Reactivated by platform owner", companies());
      if (ok) bump();
      return ok;
    },
    remove: async (slug: string) => {
      if (isSupabaseConfigured()) {
        const cachedId = companies()?.find((c) => c.slug === slug)?.id;
        const id =
          cachedId && cachedId.length > 20 ? cachedId : await findCompanyIdBySlug(slug);
        if (!id) {
          toast.error("Company not found in database");
          return false;
        }
        const result = await deleteCompanyRemote(id);
        if (!result.ok) {
          toast.error(result.error ?? "Could not delete company");
          return false;
        }
        softDeleteCompany(slug);
        bump();
        return true;
      }
      softDeleteCompany(slug);
      bump();
      return true;
    },
  };
}

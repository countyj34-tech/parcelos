import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPlatformCompany,
  fetchPlatformCompanies,
  fetchPlatformOverview,
  type CreateCompanyInput,
} from "@/lib/api/companies";
import { findCompanyIdBySlug, setCompanyLifecycleRemote } from "@/lib/api/tenant";
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
    });
  }, [queryClient]);

  return query;
}

export function usePlatformOverviewStats() {
  return useQuery({
    queryKey: ["platform", "overview"],
    queryFn: fetchPlatformOverview,
    staleTime: 60_000,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCompanyInput) => createPlatformCompany(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "companies"] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "overview"] });
    },
  });
}

async function applyLifecycle(slug: string, status: LifecycleStatus, reason: string) {
  if (isSupabaseConfigured()) {
    const id = await findCompanyIdBySlug(slug);
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
  };

  return {
    pause: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Paused", "Paused by platform owner");
      if (ok) bump();
      return ok;
    },
    suspend: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Suspended", "Suspended for non-payment");
      if (ok) bump();
      return ok;
    },
    disconnect: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Disconnected", "Disconnected by platform owner");
      if (ok) bump();
      return ok;
    },
    reactivate: async (slug: string) => {
      const ok = await applyLifecycle(slug, "Active", "Reactivated by platform owner");
      if (ok) bump();
      return ok;
    },
    remove: async (slug: string) => {
      if (isSupabaseConfigured()) {
        const ok = await applyLifecycle(slug, "Disconnected", "Deleted by platform owner");
        if (ok) bump();
        return ok;
      }
      softDeleteCompany(slug);
      bump();
      return true;
    },
  };
}

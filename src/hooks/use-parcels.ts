import { useDeferredValue, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchParcels, fetchParcelByTracking, type ParcelFilters } from "@/lib/api/parcels";
import {
  fetchCompanyBranchesDetailed,
  fetchCompanyCustomers,
  fetchCompanyDashboard,
  fetchCompanyPayments,
  fetchCompanyStaff,
  fetchCompanyVehicles,
  fetchCustomerParcels,
} from "@/lib/api/company-ops";
import { listCompanyBranches } from "@/lib/api/parcels";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function useParcels(filters: ParcelFilters = {}) {
  const deferredSearch = useDeferredValue(filters.search ?? "");
  const stableFilters = useMemo(
    () => ({
      ...filters,
      search: deferredSearch || undefined,
    }),
    [filters.status, filters.branch, filters.branchId, filters.branchScope, filters.payment, deferredSearch],
  );

  return useQuery({
    queryKey: ["parcels", stableFilters],
    queryFn: () => fetchParcels(stableFilters),
    staleTime: 20_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useParcelTracking(tracking: string) {
  return useQuery({
    queryKey: ["parcel", tracking],
    queryFn: () => fetchParcelByTracking(tracking),
    enabled: isSupabaseConfigured() && tracking.length > 3,
    staleTime: 15_000,
  });
}

export function useCompanyDashboard() {
  return useQuery({
    queryKey: ["company-dashboard"],
    queryFn: fetchCompanyDashboard,
    staleTime: 20_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useCompanyBranches() {
  return useQuery({
    queryKey: ["company-branches"],
    queryFn: fetchCompanyBranchesDetailed,
    staleTime: 60_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useBranchNames(companyId: string | null | undefined) {
  return useQuery({
    queryKey: ["branch-names", companyId],
    queryFn: () => listCompanyBranches(companyId!),
    enabled: Boolean(companyId) && isSupabaseConfigured(),
    staleTime: 120_000,
  });
}

export function useCompanyCustomers(search: string) {
  const deferred = useDeferredValue(search);
  return useQuery({
    queryKey: ["company-customers", deferred],
    queryFn: () => fetchCompanyCustomers(deferred),
    staleTime: 30_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useCustomerParcels(phone: string | null) {
  return useQuery({
    queryKey: ["customer-parcels", phone],
    queryFn: () => fetchCustomerParcels(phone!),
    enabled: Boolean(phone) && isSupabaseConfigured(),
    staleTime: 20_000,
  });
}

export function useCompanyStaff() {
  return useQuery({
    queryKey: ["company-staff"],
    queryFn: fetchCompanyStaff,
    staleTime: 10_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useCompanyPayments() {
  return useQuery({
    queryKey: ["company-payments"],
    queryFn: fetchCompanyPayments,
    staleTime: 20_000,
    enabled: isSupabaseConfigured(),
  });
}

export function useCompanyDispatch() {
  return useQuery({
    queryKey: ["company-dispatch"],
    queryFn: fetchCompanyVehicles,
    staleTime: 30_000,
    enabled: isSupabaseConfigured(),
  });
}

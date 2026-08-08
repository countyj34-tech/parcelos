import { useQuery } from "@tanstack/react-query";
import { fetchParcels, fetchParcelByTracking, type ParcelFilters } from "@/lib/api/parcels";

export function useParcels(filters: ParcelFilters = {}) {
  return useQuery({
    queryKey: ["parcels", filters],
    queryFn: () => fetchParcels(filters),
    staleTime: 30_000,
  });
}

export function useParcelTracking(tracking: string) {
  return useQuery({
    queryKey: ["parcel", tracking],
    queryFn: () => fetchParcelByTracking(tracking),
    enabled: tracking.length > 3,
  });
}

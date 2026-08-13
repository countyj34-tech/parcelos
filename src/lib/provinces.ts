/** Destination provinces for customer parcel registration (Zambia-first). */
export const DESTINATION_PROVINCES = [
  "Lusaka",
  "Copperbelt",
  "Central",
  "Eastern",
  "Southern",
  "Western",
  "Northern",
  "North-Western",
  "Luapula",
  "Muchinga",
] as const;

export type DestinationProvince = (typeof DESTINATION_PROVINCES)[number];

export const OTHER_PROVINCE_VALUE = "__other__";

export function matchBranchForProvince(
  branches: Array<{ id: string; name: string }>,
  province: string,
): string | null {
  const needle = province.trim().toLowerCase();
  if (!needle || !branches.length) return null;
  const hit = branches.find((b) => b.name.toLowerCase().includes(needle));
  return hit?.id ?? null;
}

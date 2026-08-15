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

/** Province → towns we store on branch name/city, so Copperbelt matches Ndola not Lusaka. */
const PROVINCE_CITY_ALIASES: Record<string, string[]> = {
  lusaka: ["lusaka", "chilanga", "kafue"],
  copperbelt: ["ndola", "kitwe", "chingola", "mufulira", "luanshya", "kalulushi", "chililabombwe", "kasumbalesa"],
  central: ["kabwe", "kapiri", "mkushi"],
  eastern: ["chipata", "petauke"],
  southern: ["livingstone", "choma", "mazabuka", "monze"],
  western: ["mongu", "sesheke"],
  northern: ["kasama"],
  "north-western": ["solwezi"],
  luapula: ["mansa"],
  muchinga: ["chinsali", "mpika"],
};

function branchHaystack(b: { name: string; city?: string | null }): string {
  return `${b.name} ${b.city ?? ""}`.toLowerCase();
}

export function branchesForProvince<T extends { id: string; name: string; city?: string | null }>(
  branches: T[],
  province: string,
): T[] {
  const needle = province.trim().toLowerCase();
  if (!needle || !branches.length) return [];
  const aliases = PROVINCE_CITY_ALIASES[needle] ?? [needle];
  const matched = branches.filter((b) => {
    const hay = branchHaystack(b);
    return hay.includes(needle) || aliases.some((a) => hay.includes(a));
  });
  return matched.length ? matched : branches;
}

export function matchBranchForProvince(
  branches: Array<{ id: string; name: string; city?: string | null }>,
  province: string,
): string | null {
  return branchesForProvince(branches, province)[0]?.id ?? null;
}

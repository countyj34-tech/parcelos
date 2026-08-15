/** Zambia city centres — used to pre-fill branch GPS when staff have not pinned the office. */

export const ZM_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  lusaka: { lat: -15.387526, lng: 28.322817 },
  ndola: { lat: -12.958686, lng: 28.636589 },
  kitwe: { lat: -12.802431, lng: 28.213234 },
  livingstone: { lat: -17.84193, lng: 25.85437 },
  chipata: { lat: -13.63328, lng: 32.64521 },
  kabwe: { lat: -14.4469, lng: 28.44644 },
  chingola: { lat: -12.52898, lng: 27.86139 },
  mufulira: { lat: -12.54982, lng: 28.24071 },
  luanshya: { lat: -13.13667, lng: 28.41667 },
  solwezi: { lat: -12.16896, lng: 26.38952 },
  kasama: { lat: -10.21289, lng: 31.18081 },
  mongu: { lat: -15.24836, lng: 23.12741 },
  choma: { lat: -16.80889, lng: 26.95311 },
  mazabuka: { lat: -15.85601, lng: 27.74801 },
  "kapiri mposhi": { lat: -13.97769, lng: 28.66974 },
  mansa: { lat: -11.19956, lng: 28.89431 },
  kasumbalesa: { lat: -12.277, lng: 27.811 },
  chililabombwe: { lat: -12.36467, lng: 27.82286 },
  kalulushi: { lat: -12.84151, lng: 28.09495 },
};

export const ZM_CITY_OPTIONS = [
  "Lusaka",
  "Ndola",
  "Kitwe",
  "Livingstone",
  "Chipata",
  "Kabwe",
  "Chingola",
  "Mufulira",
  "Luanshya",
  "Solwezi",
  "Kasama",
  "Mongu",
  "Choma",
  "Mazabuka",
  "Kapiri Mposhi",
  "Mansa",
  "Kasumbalesa",
  "Chililabombwe",
  "Kalulushi",
] as const;

export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(s));
}

export function coordsForCity(city: string | null | undefined): { lat: number; lng: number } | null {
  const raw = city?.trim().toLowerCase() ?? "";
  if (!raw) return null;
  const exact = ZM_CITY_COORDS[raw];
  if (exact) return exact;
  const hit = Object.entries(ZM_CITY_COORDS).find(([name]) => raw.includes(name));
  return hit?.[1] ?? null;
}

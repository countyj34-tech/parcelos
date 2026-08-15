/** Zambia phone matching so 0977, +260977 and 260977 hit the same customer. */

export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Last 9 digits (97xxxxxxx) — stable key across local / +260 formats. */
export function zambiaLocalKey(raw: string): string {
  const d = phoneDigits(raw);
  if (!d) return "";
  if (d.startsWith("260") && d.length >= 12) return d.slice(-9);
  if (d.startsWith("0") && d.length >= 10) return d.slice(-9);
  if (d.length >= 9) return d.slice(-9);
  return d;
}

export function phoneSearchVariants(raw: string): string[] {
  const key = zambiaLocalKey(raw);
  const typed = raw.trim();
  const digits = phoneDigits(raw);
  const set = new Set<string>();
  if (typed) set.add(typed);
  if (digits) set.add(digits);
  if (key) {
    set.add(key);
    set.add(`0${key}`);
    set.add(`260${key}`);
    set.add(`+260${key}`);
  }
  return [...set];
}

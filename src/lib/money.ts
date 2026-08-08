/** Format currency for display (amounts in major units, e.g. ZMW). */
export function money(n: number, currency = "ZMW") {
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

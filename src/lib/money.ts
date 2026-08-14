/** Format currency for display (amounts in major units, e.g. ZMW). Prefer K for Zambia. */
export function money(n: number, currency = "ZMW") {
  if (currency === "ZMW" || currency === "K") {
    return `K${n.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

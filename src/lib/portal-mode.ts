const CUSTOMER_MODE_KEY = "parcelos-customer-portal";

/** Set when a customer opens a company share link `/c/{slug}`. */
export function markCustomerPortalMode() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CUSTOMER_MODE_KEY, "1");
}

export function clearCustomerPortalMode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CUSTOMER_MODE_KEY);
}

/** True only after opening `/c/{slug}` in this browser session. */
export function isCustomerPortalMode(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(CUSTOMER_MODE_KEY) === "1";
}

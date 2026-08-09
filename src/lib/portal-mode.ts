const CUSTOMER_MODE_KEY = "parcelos-customer-portal";
const RECEPTION_REGISTER_KEY = "parcelos-reception-register";

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

/** Staff walk-in register — Back must return to reception desk. */
export function markReceptionRegisterMode() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RECEPTION_REGISTER_KEY, "1");
}

export function clearReceptionRegisterMode() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECEPTION_REGISTER_KEY);
}

export function isReceptionRegisterMode(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(RECEPTION_REGISTER_KEY) === "1";
}

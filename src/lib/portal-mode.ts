const CUSTOMER_MODE_KEY = "parcelos-customer-portal";
const CUSTOMER_SLUG_KEY = "parcelos-customer-slug";
const RECEPTION_REGISTER_KEY = "parcelos-reception-register";

/**
 * Customer app mode (share link / installed customer PWA).
 * Persists in localStorage so company staff can open /c/{slug} on the same
 * device, install the customer app, then return to /app for company work.
 */
export function markCustomerPortalMode(slug?: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CUSTOMER_MODE_KEY, "1");
    localStorage.setItem(CUSTOMER_MODE_KEY, "1");
    if (slug) localStorage.setItem(CUSTOMER_SLUG_KEY, slug);
  } catch {
    /* ignore */
  }
}

/** Leave customer mode when opening the company workspace. */
export function clearCustomerPortalMode() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CUSTOMER_MODE_KEY);
    localStorage.removeItem(CUSTOMER_MODE_KEY);
  } catch {
    /* ignore */
  }
}

export function isCustomerPortalMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(CUSTOMER_MODE_KEY) === "1" ||
      localStorage.getItem(CUSTOMER_MODE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function getCustomerPortalSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CUSTOMER_SLUG_KEY);
  } catch {
    return null;
  }
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

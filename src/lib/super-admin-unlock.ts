/**
 * SaaS Super Admin pattern unlock — MTHUNZI-TECH-LABS only.
 * Pattern opens the platform console (/admin) directly — no login page.
 * Company owners use /login instead.
 */

const DEVICE_KEY = "parcelos-super-admin-device";
const UNLOCK_KEY = "parcelos-super-admin-unlocked";
const UNLOCK_AT_KEY = "parcelos-super-admin-unlocked-at";

/** Unlock stays valid for 12 hours after the pattern (per browser). */
const UNLOCK_TTL_MS = 12 * 60 * 60 * 1000;

export function markSuperAdminDevice() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DEVICE_KEY, "1");
    localStorage.setItem(UNLOCK_KEY, "1");
    localStorage.setItem(UNLOCK_AT_KEY, String(Date.now()));
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function isSuperAdminDevice() {
  return isSuperAdminPatternUnlocked();
}

export function isSuperAdminPatternUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sessionOn = sessionStorage.getItem(UNLOCK_KEY) === "1";
    const localOn = localStorage.getItem(UNLOCK_KEY) === "1";
    if (!sessionOn && !localOn) return false;

    const at = Number(localStorage.getItem(UNLOCK_AT_KEY) || "0");
    if (at && Date.now() - at > UNLOCK_TTL_MS) {
      clearSuperAdminDevice();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearSuperAdminDevice() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_AT_KEY);
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

export function getPlatformOwnerLoginEmail(): string {
  return (
    (import.meta.env.VITE_PLATFORM_OWNER_EMAIL as string | undefined)?.trim() ||
    "mthunzilabs@gmail.com"
  );
}

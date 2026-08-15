import { useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBranchNames } from "@/hooks/use-parcels";

const EVENT = "parcelos-workspace-branch";

function storageKey(companyId: string | null | undefined) {
  return `parcelos-workspace-branch:${companyId || "demo"}`;
}

function readStored(companyId: string | null | undefined): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(storageKey(companyId)) ?? "";
  } catch {
    return "";
  }
}

export function setWorkspaceBranch(companyId: string | null | undefined, value: string) {
  localStorage.setItem(storageKey(companyId), value);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Office the staff member is working at — drives drop-off vs Ndola collection lists. */
export function useWorkspaceBranch() {
  const { user, role, companyId } = useAuth();
  const { data: branches = [] } = useBranchNames(companyId);
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(companyId),
    () => "",
  );

  const canSeeAll = role === "Company Admin" || role === "Super Admin" || role === "Auditor";

  const resolved = useMemo(() => {
    const hitByName = (name: string | null | undefined) =>
      name ? branches.find((b) => b.name === name) : undefined;

    if (stored === "all" && canSeeAll) {
      return { name: null as string | null, id: null as string | null, label: "All branches", isAll: true };
    }
    if (stored && stored !== "all") {
      const hit = hitByName(stored);
      return { name: stored, id: hit?.id ?? null, label: stored, isAll: false };
    }
    if (user.branch && user.branch !== "All Branches") {
      const hit = hitByName(user.branch);
      return { name: user.branch, id: hit?.id ?? null, label: user.branch, isAll: false };
    }
    if (canSeeAll) {
      return { name: null, id: null, label: "All branches", isAll: true };
    }
    if (branches[0]) {
      return {
        name: branches[0].name,
        id: branches[0].id,
        label: branches[0].name,
        isAll: false,
      };
    }
    return { name: null, id: null, label: "All branches", isAll: true };
  }, [stored, branches, user.branch, canSeeAll]);

  return {
    isAll: resolved.isAll,
    branchName: resolved.name,
    branchId: resolved.id,
    label: resolved.label,
    canSeeAll,
    branches,
    setBranch: (value: string) => setWorkspaceBranch(companyId, value),
  };
}

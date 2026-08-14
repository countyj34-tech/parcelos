import { useEffect, useState, type ReactNode } from "react";

type ClientOnlyProps = {
  /** Pass a function so browser-only children are not evaluated during SSR. */
  children: ReactNode | (() => ReactNode);
  fallback?: ReactNode;
};

/** Avoid SSR/hydration crashes for browser-only UI (charts, localStorage gates). */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{typeof children === "function" ? children() : children}</>;
}

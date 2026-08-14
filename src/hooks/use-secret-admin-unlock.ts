import { useCallback, useRef } from "react";

/**
 * Secret platform unlock on logo taps:
 * 2 taps → pause → 4 taps → pause → 7 taps → pause → 1 tap
 */
const PATTERN = [2, 4, 7, 1] as const;

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function timing() {
  const mobile = isCoarsePointer();
  return {
    pauseMs: mobile ? 320 : 500,
    tapGapMs: mobile ? 1800 : 1400,
    idleResetMs: mobile ? 20000 : 12000,
  };
}

export function useSecretAdminUnlock(onUnlock: () => void) {
  const groupIndex = useRef(0);
  const tapsInGroup = useRef(0);
  const lastTapAt = useRef(0);
  const groupCompletedAt = useRef(0);
  const awaitingPause = useRef(false);
  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;

  const reset = useCallback(() => {
    groupIndex.current = 0;
    tapsInGroup.current = 0;
    lastTapAt.current = 0;
    groupCompletedAt.current = 0;
    awaitingPause.current = false;
  }, []);

  const registerTap = useCallback(() => {
    const { pauseMs, tapGapMs, idleResetMs } = timing();
    const now = Date.now();

    if (lastTapAt.current && now - lastTapAt.current > idleResetMs) {
      reset();
    }

    if (awaitingPause.current) {
      if (now - groupCompletedAt.current < pauseMs) {
        return;
      }
      awaitingPause.current = false;
      tapsInGroup.current = 0;
    }

    if (tapsInGroup.current > 0 && now - lastTapAt.current > tapGapMs) {
      reset();
    }

    const needed = PATTERN[groupIndex.current];
    if (needed == null) {
      reset();
      return;
    }

    const nextTap = tapsInGroup.current + 1;
    if (nextTap > needed) {
      if (isCoarsePointer()) return;
      reset();
      return;
    }

    tapsInGroup.current = nextTap;
    lastTapAt.current = now;

    if (tapsInGroup.current === needed) {
      groupIndex.current += 1;
      tapsInGroup.current = 0;
      groupCompletedAt.current = now;

      if (groupIndex.current >= PATTERN.length) {
        reset();
        onUnlockRef.current();
        return;
      }

      awaitingPause.current = true;
    }
  }, [reset]);

  const onLogoTap = useCallback(
    (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      registerTap();
    },
    [registerTap],
  );

  return { onLogoTap, registerTap };
}

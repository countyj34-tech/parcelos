import { useCallback, useRef } from "react";

/**
 * Secret platform unlock on logo taps:
 * 2 taps → pause → 4 taps → pause → 7 taps → pause → 1 tap
 *
 * Timing is forgiving on phones (touch is slower / less precise than mouse).
 */
const PATTERN = [2, 4, 7, 1] as const;

function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function timing() {
  const mobile = isCoarsePointer();
  return {
    /** Minimum idle between groups (the pause). */
    pauseMs: mobile ? 450 : 600,
    /** Max gap between taps inside one group. */
    tapGapMs: mobile ? 1100 : 700,
    /** Reset if idle mid-sequence. */
    idleResetMs: mobile ? 10000 : 5500,
  };
}

export function useSecretAdminUnlock(onUnlock: () => void) {
  const groupIndex = useRef(0);
  const tapsInGroup = useRef(0);
  const lastTapAt = useRef(0);
  const groupCompletedAt = useRef(0);
  const awaitingPause = useRef(false);

  const reset = useCallback(() => {
    groupIndex.current = 0;
    tapsInGroup.current = 0;
    lastTapAt.current = 0;
    groupCompletedAt.current = 0;
    awaitingPause.current = false;
  }, []);

  const onLogoTap = useCallback(
    (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();

      const { pauseMs, tapGapMs, idleResetMs } = timing();
      const now = Date.now();

      if (lastTapAt.current && now - lastTapAt.current > idleResetMs) {
        reset();
      }

      if (awaitingPause.current) {
        if (now - groupCompletedAt.current < pauseMs) {
          // Tapped too soon after a group — ignore (don't hard-reset on phones)
          if (isCoarsePointer()) return;
          reset();
          return;
        }
        awaitingPause.current = false;
        tapsInGroup.current = 0;
      }

      if (tapsInGroup.current > 0 && now - lastTapAt.current > tapGapMs) {
        reset();
      }

      tapsInGroup.current += 1;
      lastTapAt.current = now;

      const needed = PATTERN[groupIndex.current];
      if (needed == null) {
        reset();
        return;
      }

      if (tapsInGroup.current > needed) {
        reset();
        return;
      }

      if (tapsInGroup.current === needed) {
        groupIndex.current += 1;
        tapsInGroup.current = 0;
        groupCompletedAt.current = now;

        if (groupIndex.current >= PATTERN.length) {
          reset();
          onUnlock();
          return;
        }

        awaitingPause.current = true;
      }
    },
    [onUnlock, reset],
  );

  return { onLogoTap };
}

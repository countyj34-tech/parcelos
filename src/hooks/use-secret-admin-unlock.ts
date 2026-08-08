import { useCallback, useRef } from "react";

/**
 * Secret platform unlock on logo taps:
 * 2 taps → pause → 4 taps → pause → 7 taps → pause → 1 tap
 */
const PATTERN = [2, 4, 7, 1] as const;
/** Minimum idle time between groups (the "pause"). */
const PAUSE_MS = 650;
/** Max gap between taps inside one group. */
const TAP_GAP_MS = 480;
/** Reset if the user goes idle mid-sequence. */
const IDLE_RESET_MS = 4500;

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

      const now = Date.now();

      if (lastTapAt.current && now - lastTapAt.current > IDLE_RESET_MS) {
        reset();
      }

      if (awaitingPause.current) {
        if (now - groupCompletedAt.current < PAUSE_MS) {
          // Tapped too soon after a group — sequence broken
          reset();
          return;
        }
        awaitingPause.current = false;
        tapsInGroup.current = 0;
      }

      if (tapsInGroup.current > 0 && now - lastTapAt.current > TAP_GAP_MS) {
        // Gap too long inside a group
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

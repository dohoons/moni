import type { CSSProperties } from 'react';
import { useDialogViewport } from './useDialogViewport';

interface UseModalViewportAdjustmentOptions {
  open: boolean;
  enabled?: boolean;
  bottomGap?: number;
}

export function useModalViewportAdjustment({
  open,
  enabled = false,
  bottomGap = 8,
}: UseModalViewportAdjustmentOptions): CSSProperties | undefined {
  const { isMobile, keyboardInset } = useDialogViewport(open);

  if (!enabled || !isMobile) return undefined;

  return {
    marginBottom: keyboardInset,
    maxHeight: `calc(100dvh - ${bottomGap + keyboardInset}px - env(safe-area-inset-top, 0px))`,
  };
}

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

const getIsMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

export function useDialogViewport(enabled: boolean) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? getIsMobile() : false
  );
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handleMediaChange = () => {
      setIsMobile(mediaQuery.matches);
    };

    handleMediaChange();
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateInset = () => {
      const nextInset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      setKeyboardInset(nextInset);
    };

    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);

    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, [enabled, isMobile]);

  return {
    isMobile,
    keyboardInset: enabled && isMobile ? keyboardInset : 0,
  };
}

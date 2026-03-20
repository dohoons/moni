import { useState, useRef, useCallback } from 'react';

type RefreshSource = 'pull' | 'manual';

interface UsePullToRefreshOptions {
  onRefresh: (source?: RefreshSource) => void | Promise<void>;
  isRefreshing: boolean;
  isLoading?: boolean;
  setIsRefreshing?: (value: boolean) => void;
}

export function usePullToRefresh({ onRefresh, isRefreshing, isLoading, setIsRefreshing }: UsePullToRefreshOptions) {
  const [refreshSource, setRefreshSource] = useState<RefreshSource | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const handleManualRefresh = useCallback(async (source: RefreshSource = 'manual') => {
    if (isRefreshing || isLoading) return;
    setRefreshSource(source);
    setIsRefreshing?.(true);
    try {
      await onRefresh(source);
    } finally {
      setIsRefreshing?.(false);
      setRefreshSource(null);
    }
  }, [isRefreshing, isLoading, onRefresh, setIsRefreshing]);

  const handleMainTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (window.scrollY > 2 || isRefreshing || isLoading) return;
    if (e.touches.length !== 1) return;

    pullStartYRef.current = e.touches[0].clientY;
    isPullingRef.current = false;
  }, [isRefreshing, isLoading]);

  const handleMainTouchMove = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (pullStartYRef.current === null) return;
    if (window.scrollY > 2) return;

    const deltaY = e.touches[0].clientY - pullStartYRef.current;
    if (deltaY <= 0) return;

    isPullingRef.current = true;
    const nextDistance = Math.min(96, deltaY * 0.45);
    setPullDistance(nextDistance);

    if (e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const handleMainTouchEnd = useCallback(() => {
    const shouldRefresh = isPullingRef.current && pullDistance >= 56;

    pullStartYRef.current = null;
    isPullingRef.current = false;
    setPullDistance(0);

    if (shouldRefresh) {
      void handleManualRefresh('pull');
    }
  }, [pullDistance, handleManualRefresh]);

  return {
    refreshSource,
    pullDistance,
    handleManualRefresh,
    handleMainTouchStart,
    handleMainTouchMove,
    handleMainTouchEnd,
  };
}

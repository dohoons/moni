import { useRef, useState } from 'react';
import type { CSSProperties, TouchEvent } from 'react';

interface UsePullDownToCloseOptions {
  onClose: () => void;
  threshold?: number;
  enabled?: boolean;
}

function isScrollableElement(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  const canScrollY = style.overflowY === 'auto' || style.overflowY === 'scroll';
  return canScrollY && el.scrollHeight > el.clientHeight;
}

function findScrollableAncestor(target: EventTarget | null, boundary: HTMLDivElement | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;

  let node: HTMLElement | null = target;
  while (node && node !== boundary) {
    if (isScrollableElement(node)) return node;
    node = node.parentElement;
  }
  return null;
}

export function usePullDownToClose({ onClose, threshold = 96, enabled = true }: UsePullDownToCloseOptions) {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const currentYRef = useRef(0);
  const shouldDragRef = useRef(false);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (e.touches.length !== 1) return;

    const scrollable = findScrollableAncestor(e.target, panelRef.current);
    const isAtTop = !scrollable || scrollable.scrollTop <= 0;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    currentYRef.current = 0;
    shouldDragRef.current = isAtTop;
    setIsDragging(false);
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!enabled) return;
    if (startYRef.current === null) return;
    if (!shouldDragRef.current) return;

    const deltaX = e.touches[0].clientX - (startXRef.current ?? e.touches[0].clientX);
    const deltaY = e.touches[0].clientY - startYRef.current;

    // 수평 제스처는 무시
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;
    if (deltaY <= 0) return;

    const next = deltaY * 0.95;
    currentYRef.current = next;
    setTranslateY(next);
    setIsDragging(true);

    // React touch 이벤트는 passive일 수 있어 cancelable일 때만 기본 동작을 막는다.
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const finishDrag = () => {
    if (!enabled) return;

    const shouldClose = currentYRef.current > threshold;
    startYRef.current = null;
    startXRef.current = null;
    currentYRef.current = 0;
    shouldDragRef.current = false;
    setIsDragging(false);
    setTranslateY(0);
    if (shouldClose) onClose();
  };

  const onTouchEnd = () => finishDrag();
  const onTouchCancel = () => finishDrag();

  const panelStyle: CSSProperties = {
    transform: translateY ? `translateY(${translateY}px)` : undefined,
    transition: isDragging ? 'none' : 'transform 0.18s ease',
  };

  return {
    panelRef,
    panelStyle,
    panelTouch: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  };
}

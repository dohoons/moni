import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { useModalViewportAdjustment } from '../hooks/useModalViewportAdjustment';
import { usePullDownToClose } from '../hooks/usePullDownToClose';

const modalStack: symbol[] = [];

const pushModal = (id: symbol) => {
  const existingIndex = modalStack.indexOf(id);
  if (existingIndex >= 0) {
    modalStack.splice(existingIndex, 1);
  }
  modalStack.push(id);
};

const removeModal = (id: symbol) => {
  const index = modalStack.indexOf(id);
  if (index >= 0) {
    modalStack.splice(index, 1);
  }
};

const isTopModal = (id: symbol) => modalStack[modalStack.length - 1] === id;

interface ModalShellProps {
  open: boolean;
  onBackdropClick: () => void;
  onAfterClose?: () => void;
  closeOnEsc?: boolean;
  onEsc?: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  children: ReactNode;
  panelRef?: Ref<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  panelProps?: HTMLAttributes<HTMLDivElement>;
  allowPinchZoom?: boolean;
  adjustForViewport?: boolean;
  viewportBottomGap?: number;
  variant?: 'custom' | 'sheet';
  sheetZIndexClassName?: string;
  sheetBackdropClassName?: string;
  sheetPanelMaxWidthClassName?: string;
  sheetPanelMaxHeightClassName?: string;
  pullToClose?: boolean | { enabled?: boolean; threshold?: number };
}

interface ModalSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface ModalFooterProps extends ModalSectionProps {
  safeArea?: boolean;
}

const joinClassNames = (...classNames: Array<string | undefined | false>) =>
  classNames.filter(Boolean).join(' ');

function ModalShell({
  open,
  onBackdropClick,
  onAfterClose,
  closeOnEsc = true,
  onEsc,
  overlayClassName,
  panelClassName,
  children,
  panelRef,
  panelStyle,
  overlayStyle,
  panelProps,
  allowPinchZoom = true,
  adjustForViewport = false,
  viewportBottomGap = 8,
  variant = 'custom',
  sheetZIndexClassName = 'z-50',
  sheetBackdropClassName = 'bg-black/50',
  sheetPanelMaxWidthClassName = 'sm:max-w-md',
  sheetPanelMaxHeightClassName = 'max-h-[90dvh] sm:max-h-[calc(100vh-2rem)]',
  pullToClose = false,
}: ModalShellProps) {
  const EXIT_DURATION_MS = 150;
  const [isRendered, setIsRendered] = useState(open);
  const closeTimerRef = useRef<number | null>(null);
  const modalIdRef = useRef(Symbol('modal-shell'));
  const pullToCloseOptions = typeof pullToClose === 'boolean' ? { enabled: pullToClose } : pullToClose;
  const pullDownToClose = usePullDownToClose({
    onClose: onBackdropClick,
    enabled: open && (pullToCloseOptions?.enabled ?? false),
    threshold: pullToCloseOptions?.threshold,
  });
  const runAfterClose = useEffectEvent(() => {
    onAfterClose?.();
  });
  const runEscClose = useEffectEvent(() => {
    (onEsc ?? onBackdropClick)();
  });
  const viewportStyle = useModalViewportAdjustment({
    open,
    enabled: adjustForViewport,
    bottomGap: viewportBottomGap,
  });
  const {
    onClick: panelOnClick,
    className: panelExtraClassName,
    onTouchStart: panelTouchStart,
    onTouchMove: panelTouchMove,
    onTouchEnd: panelTouchEnd,
    onTouchCancel: panelTouchCancel,
    ...restPanelProps
  } = panelProps ?? {};

  useEffect(() => {
    if (!open) return;

    const modalId = modalIdRef.current;
    pushModal(modalId);

    return () => {
      removeModal(modalId);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;
      if (!isTopModal(modalIdRef.current)) return;

      event.preventDefault();
      event.stopPropagation();
      runEscClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, closeOnEsc]);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open) {
      setIsRendered(true);
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsRendered(false);
      runAfterClose();
      closeTimerRef.current = null;
    }, EXIT_DURATION_MS);

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open]);

  const handlePanelClick: NonNullable<HTMLAttributes<HTMLDivElement>['onClick']> = (event) => {
    event.stopPropagation();
    panelOnClick?.(event);
  };
  const handlePanelTouchStart: NonNullable<HTMLAttributes<HTMLDivElement>['onTouchStart']> = (event) => {
    pullDownToClose.panelTouch.onTouchStart(event);
    panelTouchStart?.(event);
  };
  const handlePanelTouchMove: NonNullable<HTMLAttributes<HTMLDivElement>['onTouchMove']> = (event) => {
    pullDownToClose.panelTouch.onTouchMove(event);
    panelTouchMove?.(event);
  };
  const handlePanelTouchEnd: NonNullable<HTMLAttributes<HTMLDivElement>['onTouchEnd']> = (event) => {
    pullDownToClose.panelTouch.onTouchEnd();
    panelTouchEnd?.(event);
  };
  const handlePanelTouchCancel: NonNullable<HTMLAttributes<HTMLDivElement>['onTouchCancel']> = (event) => {
    pullDownToClose.panelTouch.onTouchCancel();
    panelTouchCancel?.(event);
  };
  const setPanelRef = (node: HTMLDivElement | null) => {
    pullDownToClose.panelRef.current = node;
    if (!panelRef) return;
    if (typeof panelRef === 'function') {
      panelRef(node);
      return;
    }
    panelRef.current = node;
  };

  if (!isRendered) return null;

  const overlayMotionStyle: CSSProperties = {
    opacity: open ? 1 : 0,
    transition: `opacity ${EXIT_DURATION_MS}ms ease`,
    pointerEvents: open ? 'auto' : 'none',
    ...overlayStyle,
  };

  const panelMotionStyle: CSSProperties = {
    opacity: open ? 1 : 0,
    transform: open ? 'none' : 'translateY(24px)',
    transition: `transform ${EXIT_DURATION_MS}ms ease, opacity ${EXIT_DURATION_MS}ms ease`,
  };
  const mergedPanelStyle: CSSProperties | undefined =
    panelStyle || pullDownToClose.panelStyle || viewportStyle
      ? { ...panelStyle, ...pullDownToClose.panelStyle, ...viewportStyle }
      : undefined;
  const resolvedOverlayClassName =
    variant === 'sheet'
      ? joinClassNames(
          'fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4',
          sheetZIndexClassName,
          sheetBackdropClassName,
          overlayClassName
        )
      : overlayClassName ??
        'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4';
  const resolvedPanelClassName =
    variant === 'sheet'
      ? joinClassNames(
          'flex w-full max-w-none flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          sheetPanelMaxHeightClassName,
          sheetPanelMaxWidthClassName,
          panelClassName
        )
      : panelClassName ?? 'w-full max-w-none rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl';

  return (
    <RemoveScroll enabled={open} allowPinchZoom={allowPinchZoom}>
      <div className={resolvedOverlayClassName} style={overlayMotionStyle} onClick={open ? onBackdropClick : undefined}>
        <div className="flex w-full justify-center" style={panelMotionStyle}>
          <div
            {...restPanelProps}
            className={panelExtraClassName ? `${resolvedPanelClassName} ${panelExtraClassName}` : resolvedPanelClassName}
            ref={setPanelRef}
            style={mergedPanelStyle}
            onClick={handlePanelClick}
            onTouchStart={handlePanelTouchStart}
            onTouchMove={handlePanelTouchMove}
            onTouchEnd={handlePanelTouchEnd}
            onTouchCancel={handlePanelTouchCancel}
          >
            {children}
          </div>
        </div>
      </div>
    </RemoveScroll>
  );
}

const ModalHeader = ({ children, className, ...props }: ModalSectionProps) => (
  <div {...props} className={joinClassNames('border-b border-gray-200 px-6 py-4', className)}>
    {children}
  </div>
);

const ModalBody = ({ children, className, ...props }: ModalSectionProps) => (
  <div {...props} className={joinClassNames('min-h-0 flex-1 overflow-y-auto px-6 py-4', className)}>
    {children}
  </div>
);

const ModalFooter = ({ children, className, safeArea = true, ...props }: ModalFooterProps) => (
  <div
    {...props}
    className={joinClassNames(
      'border-t border-gray-200 px-6 pt-4 sm:py-4',
      safeArea ? 'pb-[max(1rem,env(safe-area-inset-bottom,0px))]' : undefined,
      className
    )}
  >
    {children}
  </div>
);

const ModalSheetHandle = ({ className, ...props }: Omit<HTMLAttributes<HTMLDivElement>, 'children'>) => (
  <div {...props} className={joinClassNames('flex justify-center px-6 pb-1 pt-3 sm:hidden', className)}>
    <div className="h-1.5 w-10 rounded-full bg-gray-300" />
  </div>
);

const CompoundModalShell = Object.assign(ModalShell, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
  SheetHandle: ModalSheetHandle,
});

export default CompoundModalShell;

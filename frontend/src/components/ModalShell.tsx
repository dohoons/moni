import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import { RemoveScroll } from 'react-remove-scroll';

interface ModalShellProps {
  open: boolean;
  onBackdropClick: () => void;
  overlayClassName: string;
  panelClassName: string;
  children: ReactNode;
  panelRef?: Ref<HTMLDivElement>;
  panelStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  panelProps?: HTMLAttributes<HTMLDivElement>;
  allowPinchZoom?: boolean;
}

function ModalShell({
  open,
  onBackdropClick,
  overlayClassName,
  panelClassName,
  children,
  panelRef,
  panelStyle,
  overlayStyle,
  panelProps,
  allowPinchZoom = true,
}: ModalShellProps) {
  const EXIT_DURATION_MS = 150;
  const [isRendered, setIsRendered] = useState(open);
  const closeTimerRef = useRef<number | null>(null);
  const { onClick: panelOnClick, className: panelExtraClassName, ...restPanelProps } = panelProps ?? {};

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

  return (
    <RemoveScroll enabled={open} allowPinchZoom={allowPinchZoom}>
      <div className={overlayClassName} style={overlayMotionStyle} onClick={open ? onBackdropClick : undefined}>
        <div className="flex w-full justify-center" style={panelMotionStyle}>
          <div
            {...restPanelProps}
            className={panelExtraClassName ? `${panelClassName} ${panelExtraClassName}` : panelClassName}
            ref={panelRef}
            style={panelStyle}
            onClick={handlePanelClick}
          >
            {children}
          </div>
        </div>
      </div>
    </RemoveScroll>
  );
}

export default ModalShell;

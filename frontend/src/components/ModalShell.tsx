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
  const { onClick: panelOnClick, className: panelExtraClassName, ...restPanelProps } = panelProps ?? {};

  const handlePanelClick: NonNullable<HTMLAttributes<HTMLDivElement>['onClick']> = (event) => {
    event.stopPropagation();
    panelOnClick?.(event);
  };

  return (
    <RemoveScroll enabled={open} allowPinchZoom={allowPinchZoom}>
      <div className={overlayClassName} style={overlayStyle} onClick={onBackdropClick}>
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
    </RemoveScroll>
  );
}

export default ModalShell;

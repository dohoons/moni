import { useCallback, useEffect, useMemo, useRef } from 'react';
import { overlay } from 'overlay-kit';
import {
  setMessageDialogHandlers,
  type MessageDialogOptions,
} from '../services/message-dialog';
import ModalShell from './ModalShell';

interface OverlayController<TResult> {
  isOpen: boolean;
  close: (result: TResult) => void;
  unmount: () => void;
}

interface MessageDialogOverlayProps {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  message: string;
  options?: MessageDialogOptions;
  onPrimary: () => void;
  onDismiss: () => void;
  onAfterClose: () => void;
}

function MessageDialogOverlay({
  isOpen,
  type,
  message,
  options,
  onPrimary,
  onDismiss,
  onAfterClose,
}: MessageDialogOverlayProps) {
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const isDangerTone = options?.tone === 'danger';

  const primaryButtonClass = isDangerTone
    ? 'flex-1 rounded-xl border-2 border-red-200 bg-red-600 px-4 py-3 font-medium text-white transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
    : 'flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const secondaryButtonClass =
    'flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2';

  useEffect(() => {
    if (!isOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      primaryButtonRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, onAfterClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      event.preventDefault();
      event.stopPropagation();
      onPrimary();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, onPrimary]);

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      closeOnEsc={options?.allowEscClose !== false}
      onBackdropClick={() => {
        if (options?.allowEscClose === false) return;
        onDismiss();
      }}
      overlayClassName="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      panelClassName="w-full max-w-none rounded-t-2xl bg-white shadow-xl ring-1 ring-black/5 sm:max-w-sm sm:rounded-2xl"
      adjustForViewport
      panelProps={{
        role: type === 'alert' ? 'alertdialog' : 'dialog',
        'aria-modal': true,
        'aria-label': options?.title || message,
      }}
    >
      <div className="border-b border-gray-100 px-6 py-5 sm:px-5 sm:py-4">
        <h3 className="text-lg font-bold text-gray-900 sm:text-base sm:font-semibold">
          {options?.title || message}
        </h3>
      </div>
      {options?.description && (
        <div className="px-6 py-5 sm:px-5 sm:py-4">
          <p className="whitespace-pre-wrap text-base leading-7 text-gray-700 sm:text-sm sm:leading-6">
            {options.description}
          </p>
        </div>
      )}
      <ModalShell.Footer className="border-gray-100 px-6 sm:px-5">
        {type === 'confirm' && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className={secondaryButtonClass}
            >
              {options?.secondaryLabel || '취소'}
            </button>
            <button
              type="button"
              ref={primaryButtonRef}
              onClick={onPrimary}
              className={primaryButtonClass}
            >
              {options?.primaryLabel || '확인'}
            </button>
          </div>
        )}
        {type === 'alert' && (
          <div className="flex">
            <button
              type="button"
              ref={primaryButtonRef}
              onClick={onPrimary}
              className={primaryButtonClass}
            >
              {options?.primaryLabel || '확인'}
            </button>
          </div>
        )}
      </ModalShell.Footer>
    </ModalShell>
  );
}

function MessageDialogProvider() {
  const openDialog = useCallback(
    (
      type: 'alert' | 'confirm',
      message: string,
      options?: MessageDialogOptions
    ) =>
      overlay.openAsync<boolean>(({ isOpen, close, unmount }: OverlayController<boolean>) => (
        <MessageDialogOverlay
          isOpen={isOpen}
          type={type}
          message={message}
          options={options}
          onPrimary={() => close(true)}
          onDismiss={() => close(false)}
          onAfterClose={unmount}
        />
      )),
    []
  );

  const dialogHandlers = useMemo(
    () => ({
      alert: async (message: string, options?: MessageDialogOptions) => {
        await openDialog('alert', message, options);
      },
      confirm: (message: string, options?: MessageDialogOptions) =>
        openDialog('confirm', message, options),
    }),
    [openDialog]
  );

  useEffect(() => {
    setMessageDialogHandlers(dialogHandlers);
    return () => {
      setMessageDialogHandlers(null);
    };
  }, [dialogHandlers]);

  return null;
}

export default MessageDialogProvider;

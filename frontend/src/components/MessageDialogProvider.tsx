import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  setMessageDialogHandlers,
  type MessageDialogOptions,
} from '../services/message-dialog';
import { useDialogViewport } from '../hooks/useDialogViewport';

type DialogType = 'alert' | 'confirm';
type DialogAction = 'primary' | 'dismiss';

interface DialogEntry {
  id: number;
  type: DialogType;
  message: string;
  options?: MessageDialogOptions;
  resolve: (confirmed: boolean) => void;
}

interface MessageDialogProviderProps {
  children: React.ReactNode;
}

function MessageDialogProvider({ children }: MessageDialogProviderProps) {
  const [dialogStack, setDialogStack] = useState<DialogEntry[]>([]);
  const idRef = useRef(0);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const topDialog = dialogStack[dialogStack.length - 1] ?? null;
  const { isMobile, keyboardInset } = useDialogViewport(Boolean(topDialog));
  const isDangerTone = topDialog?.options?.tone === 'danger';
  const primaryButtonClass = isDangerTone
    ? 'flex-1 rounded-xl border-2 border-red-200 bg-red-600 px-4 py-3 font-medium text-white transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
    : 'flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
  const secondaryButtonClass =
    'flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2';

  const closeTopDialog = useCallback((action: DialogAction) => {
    setDialogStack((prev) => {
      const current = prev[prev.length - 1];
      if (!current) return prev;

      const didConfirm = action === 'primary';
      current.resolve(didConfirm);
      return prev.slice(0, -1);
    });
  }, []);

  const openDialog = useCallback(
    (type: DialogType, message: string, options?: MessageDialogOptions) =>
      new Promise<boolean>((resolve) => {
        setDialogStack((prev) => [
          ...prev,
          {
            id: ++idRef.current,
            type,
            message,
            options,
            resolve,
          },
        ]);
      }),
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

  useEffect(() => {
    if (!topDialog) return;

    const focusPrimary = () => {
      primaryButtonRef.current?.focus();
    };

    const rafId = window.requestAnimationFrame(focusPrimary);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [topDialog?.id]);

  useEffect(() => {
    if (!topDialog) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!topDialog) return;

      if (event.key === 'Escape') {
        if (topDialog.options?.allowEscClose === false) return;
        event.preventDefault();
        event.stopPropagation();
        closeTopDialog('dismiss');
        return;
      }

      if (event.key !== 'Enter') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      event.preventDefault();
      event.stopPropagation();
      closeTopDialog('primary');
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [topDialog, closeTopDialog]);

  return (
    <>
      {children}
      {topDialog &&
        createPortal(
          <div
            className="fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            style={{ zIndex: 2000 + dialogStack.length * 10 }}
            onClick={() => {
              if (topDialog.options?.allowEscClose === false) return;
              closeTopDialog('dismiss');
            }}
          >
            <div
              role={topDialog.type === 'alert' ? 'alertdialog' : 'dialog'}
              aria-modal="true"
              aria-label={topDialog.options?.title || topDialog.message}
              className="w-full max-w-none rounded-t-2xl bg-white shadow-xl ring-1 ring-black/5 sm:max-w-sm sm:rounded-2xl"
              style={{
                marginBottom: isMobile ? keyboardInset : undefined,
                maxHeight: isMobile ? `calc(100dvh - ${8 + keyboardInset}px)` : undefined,
              }}
              data-message-dialog
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-gray-100 px-6 py-5 sm:px-5 sm:py-4">
                <h3 className="text-lg font-bold text-gray-900 sm:text-base sm:font-semibold">
                  {topDialog.options?.title || topDialog.message}
                </h3>
              </div>
              {topDialog.options?.description && (
                <div className="px-6 py-5 sm:px-5 sm:py-4">
                  <p className="whitespace-pre-wrap text-base leading-7 text-gray-700 sm:text-sm sm:leading-6">
                    {topDialog.options.description}
                  </p>
                </div>
              )}
              <div className="border-t border-gray-100 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-4">
                {topDialog.type === 'confirm' && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => closeTopDialog('dismiss')}
                      className={secondaryButtonClass}
                    >
                      {topDialog.options?.secondaryLabel || '취소'}
                    </button>
                    <button
                      type="button"
                      ref={primaryButtonRef}
                      onClick={() => closeTopDialog('primary')}
                      className={primaryButtonClass}
                    >
                      {topDialog.options?.primaryLabel || '확인'}
                    </button>
                  </div>
                )}
                {topDialog.type === 'alert' && (
                  <div className="flex">
                    <button
                      type="button"
                      ref={primaryButtonRef}
                      onClick={() => closeTopDialog('primary')}
                      className={primaryButtonClass}
                    >
                      {topDialog.options?.primaryLabel || '확인'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default MessageDialogProvider;

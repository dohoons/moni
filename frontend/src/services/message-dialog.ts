export interface MessageDialogOptions {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  allowEscClose?: boolean;
  tone?: 'default' | 'danger';
}

type AlertHandler = (message: string, options?: MessageDialogOptions) => Promise<void>;
type ConfirmHandler = (message: string, options?: MessageDialogOptions) => Promise<boolean>;

interface MessageDialogHandlers {
  alert: AlertHandler;
  confirm: ConfirmHandler;
}

let handlers: MessageDialogHandlers | null = null;
const pendingCalls: Array<() => void> = [];

const withHandlers = <T>(
  invoke: (nextHandlers: MessageDialogHandlers) => Promise<T>
): Promise<T> => {
  if (handlers) {
    return invoke(handlers);
  }

  return new Promise<T>((resolve, reject) => {
    pendingCalls.push(() => {
      if (!handlers) {
        reject(new Error('Message dialog handlers are not initialized.'));
        return;
      }
      void invoke(handlers).then(resolve).catch(reject);
    });
  });
};

const flushPendingCalls = () => {
  if (!handlers || pendingCalls.length === 0) return;

  const queued = pendingCalls.splice(0, pendingCalls.length);
  queued.forEach((run) => run());
};

export const setMessageDialogHandlers = (nextHandlers: MessageDialogHandlers | null) => {
  handlers = nextHandlers;
  if (handlers) {
    flushPendingCalls();
  }
};

export const showAlert = (message: string, options?: MessageDialogOptions) =>
  withHandlers((nextHandlers) => nextHandlers.alert(message, options));

export const showConfirm = (message: string, options?: MessageDialogOptions) =>
  withHandlers((nextHandlers) => nextHandlers.confirm(message, options));

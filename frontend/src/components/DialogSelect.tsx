import { useMemo, useState } from 'react';
import ModalShell from './ModalShell';

export interface DialogSelectOption<T extends string> {
  value: T;
  label: string;
}

interface DialogSelectProps<T extends string> {
  id: string;
  label: string;
  value: T | '';
  placeholder?: string;
  noneLabel?: string;
  options: readonly DialogSelectOption<T>[];
  onChange: (value: T | '') => void;
}

function DialogSelect<T extends string>({
  id,
  label,
  value,
  placeholder = '선택 안함',
  noneLabel = '선택 안함',
  options,
  onChange,
}: DialogSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? '',
    [options, value],
  );

  const handleSelect = (nextValue: T | '') => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-between rounded-xl border-2 border-gray-200 px-4 py-3 text-left outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <span aria-hidden="true" className="text-sm text-gray-500">
          ▼
        </span>
      </button>

      <ModalShell
        open={isOpen}
        onBackdropClick={() => setIsOpen(false)}
        overlayClassName="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        panelClassName="flex w-full max-w-none max-h-[80dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-sm sm:rounded-2xl"
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <h4 className="text-base font-semibold text-gray-900">{label} 선택</h4>
        </div>

        <div className="overflow-y-auto px-3 py-3">
          <button
            type="button"
            onClick={() => handleSelect('')}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
              value === '' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{noneLabel}</span>
            {value === '' && <span aria-hidden="true">✓</span>}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`mt-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                value === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{option.label}</span>
              {value === option.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </ModalShell>
    </>
  );
}

export default DialogSelect;

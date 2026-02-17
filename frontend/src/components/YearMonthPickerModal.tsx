import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';

interface YearMonthPickerModalProps {
  isOpen: boolean;
  initialYear: number;
  initialMonth: number;
  years: number[];
  months?: number[];
  onClose: () => void;
  onAfterClose?: () => void;
  onApply: (selection: { year: number; month: number }) => void;
}

function YearMonthPickerModal({
  isOpen,
  initialYear,
  initialMonth,
  years,
  months = Array.from({ length: 12 }, (_, i) => i + 1),
  onClose,
  onAfterClose,
  onApply,
}: YearMonthPickerModalProps) {
  const [draftYear, setDraftYear] = useState(initialYear);
  const [draftMonth, setDraftMonth] = useState(initialMonth);

  useEffect(() => {
    if (!isOpen) return;
    setDraftYear(initialYear);
    setDraftMonth(initialMonth);
  }, [isOpen, initialYear, initialMonth]);

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      variant="sheet"
      sheetZIndexClassName="z-30"
      sheetBackdropClassName="bg-black/30"
      sheetPanelMaxWidthClassName="sm:max-w-sm"
      adjustForViewport
      pullToClose
    >
      <ModalShell.SheetHandle className="px-5" />
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">년월 선택</h3>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto p-5">
        <div>
          <div className="mb-2 text-xs font-semibold text-gray-500">년도</div>
          <div className="h-48 overflow-y-auto rounded-lg border border-gray-200 p-1">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setDraftYear(year)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                  draftYear === year
                    ? 'bg-blue-600 font-semibold text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {year}년
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold text-gray-500">월</div>
          <div className="h-48 overflow-y-auto rounded-lg border border-gray-200 p-1">
            {months.map((month) => (
              <button
                key={month}
                type="button"
                onClick={() => setDraftMonth(month)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                  draftMonth === month
                    ? 'bg-blue-600 font-semibold text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {month}월
              </button>
            ))}
          </div>
        </div>
      </div>
      <ModalShell.Footer className="px-5">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onApply({ year: draftYear, month: draftMonth })}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            적용
          </button>
        </div>
      </ModalShell.Footer>
    </ModalShell>
  );
}

export default YearMonthPickerModal;

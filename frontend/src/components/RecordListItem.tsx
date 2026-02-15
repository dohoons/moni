import type { Record as TransactionRecord } from './DetailEntry';

type ListRecord = TransactionRecord & { _isSaving?: boolean };

interface RecordListItemProps {
  record: ListRecord;
  onClick: (record: ListRecord) => void;
  dataRecordId?: string;
  variant?: 'home' | 'archive';
}

function RecordListItem({ record, onClick, dataRecordId, variant = 'archive' }: RecordListItemProps) {
  const isSaving = Boolean(record._isSaving);
  const hasMemo = Boolean(record.memo?.trim());
  const displayMemo = !hasMemo && record.category === '식비'
    ? '#식비'
    : (record.memo || '-');
  const amountColorClass = isSaving && variant === 'home'
    ? 'text-gray-400'
    : (record.amount > 0 ? 'text-emerald-600' : 'text-slate-700');

  return (
    <div
      data-record-id={dataRecordId}
      onClick={() => !isSaving && onClick(record)}
      className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all ${
        isSaving ? 'cursor-default opacity-75' : 'cursor-pointer hover:shadow-md'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {isSaving && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          )}
          <p
            className={variant === 'home'
              ? `font-medium sm:text-base ${isSaving ? 'text-gray-400' : 'text-gray-900'}`
              : `font-medium text-gray-900 ${isSaving ? 'text-gray-400' : ''}`}
          >
            {displayMemo}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {record.category && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              #{record.category}
            </span>
          )}
          {record.method && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {record.method}
            </span>
          )}
        </div>
      </div>
      <div
        className={variant === 'home'
          ? `ml-4 text-right font-bold sm:text-base ${amountColorClass}`
          : `ml-4 text-right font-bold ${amountColorClass}`}
      >
        {record.amount > 0 ? '+' : ''}
        {Math.abs(record.amount).toLocaleString()}원
      </div>
    </div>
  );
}

export default RecordListItem;

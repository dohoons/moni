import { useEffect, useState } from 'react';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import {
  clearChangeHistory,
  getChangeHistory,
  removeChangeHistoryEntry,
  type ChangeHistoryEntry,
} from '../services/change-history';
import { showAlert, showConfirm } from '../services/message-dialog';
import ModalShell from './ModalShell';

interface ChangeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  onRestore: (entry: ChangeHistoryEntry) => Promise<void>;
}

function ChangeHistoryModal({ isOpen, onClose, onAfterClose, onRestore }: ChangeHistoryModalProps) {
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { panelRef, panelStyle, panelTouch } = usePullDownToClose({ onClose, enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      setEntries(getChangeHistory());
    }
  }, [isOpen]);

  const handleRestore = async (entry: ChangeHistoryEntry) => {
    setRestoringId(entry.id);
    try {
      await onRestore(entry);
      setEntries(getChangeHistory());
      onClose();
    } catch (error: any) {
      await showAlert(error?.message || '복원에 실패했습니다.');
    } finally {
      setRestoringId(null);
    }
  };

  const handleClear = async () => {
    if (
      await showConfirm('변경 이력을 모두 삭제하시겠습니까?', {
        primaryLabel: '전체 삭제',
        secondaryLabel: '취소',
        tone: 'danger',
      })
    ) {
      clearChangeHistory();
      setEntries([]);
    }
  };

  const handleDeleteEntry = async (entry: ChangeHistoryEntry) => {
    const confirmed = await showConfirm('이 변경 이력을 삭제하시겠습니까?', {
      primaryLabel: '삭제',
      secondaryLabel: '취소',
      tone: 'danger',
    });

    if (!confirmed) return;

    setDeletingId(entry.id);
    try {
      removeChangeHistoryEntry(entry.id);
      setEntries(getChangeHistory());
    } finally {
      setDeletingId(null);
    }
  };

  const renderActionLabel = (action: ChangeHistoryEntry['action']) => {
    if (action === 'create') return '추가';
    if (action === 'update') return '수정';
    return '삭제';
  };

  const fieldLabelMap: { [key: string]: string } = {
    date: '날짜',
    amount: '금액',
    memo: '메모',
    method: '결제수단',
    category: '카테고리',
  };

  const formatFieldValue = (field: string, value: unknown) => {
    if (field === 'amount') {
      const amount = Number(value || 0);
      return `${amount.toLocaleString()}원`;
    }
    if (field === 'date') {
      const date = typeof value === 'string' ? value : '';
      if (!date) return '-';
      return date;
    }
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  const formatHistoryDate = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;

    const year = String(date.getFullYear()).slice(-2);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  const getFieldDiffLines = (entry: ChangeHistoryEntry) => {
    if (!entry.before || !entry.after) return [];

    return entry.changedFields
      .filter((field) => fieldLabelMap[field])
      .map((field) => {
        const beforeValue = formatFieldValue(field, entry.before?.[field as keyof typeof entry.before]);
        const afterValue = formatFieldValue(field, entry.after?.[field as keyof typeof entry.after]);
        return `${fieldLabelMap[field]}: ${beforeValue} -> ${afterValue}`;
      });
  };

  const canRestore = (entry: ChangeHistoryEntry) => {
    if (entry.action === 'delete') return !!entry.before;
    if (entry.action === 'update') return !!entry.before;
    return !!entry.after;
  };

  const formattedEntries = entries.slice(0, 100);

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      panelClassName="flex w-full max-w-none max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100vh-2rem)] sm:max-w-lg sm:rounded-2xl"
      panelRef={panelRef}
      panelStyle={panelStyle}
      adjustForViewport
      panelProps={panelTouch}
    >
      <div className="flex justify-center px-6 pb-1 pt-3 sm:hidden">
        <div className="h-1.5 w-10 rounded-full bg-gray-300" />
      </div>
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">변경 이력</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            전체 삭제
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            닫기
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-6">
        {formattedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            저장된 변경 이력이 없습니다.
          </div>
        ) : (
          formattedEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {renderActionLabel(entry.action)}
                  </span>
                  <p className="text-xs text-gray-500">{formatHistoryDate(entry.createdAt)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDeleteEntry(entry)}
                    disabled={restoringId === entry.id || deletingId === entry.id}
                    aria-label="변경 이력 삭제"
                    title="삭제"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-300"
                  >
                    {deletingId === entry.id ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 7h12m-9 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 .917h6a1 1 0 0 0 1-.917L17 7M10 11v6m4-6v6"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRestore(entry)}
                    disabled={!canRestore(entry) || restoringId === entry.id || deletingId === entry.id}
                    aria-label="변경 이력 복원"
                    title="복원"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {restoringId === entry.id ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path
                          className="opacity-90"
                          fill="currentColor"
                          d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4Z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 14 4 9l5-5"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 9h8a6 6 0 1 1 0 12h-1"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900">
                {entry.after?.memo || entry.before?.memo || '(메모 없음)'}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                {(entry.after?.amount ?? entry.before?.amount ?? 0).toLocaleString()}원
              </p>
              {entry.action === 'update' && getFieldDiffLines(entry).length > 0 ? (
                <div className="mt-1 space-y-1 text-xs text-gray-500">
                  {getFieldDiffLines(entry).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : entry.changedFields.length > 0 ? (
                <p className="mt-1 text-xs text-gray-500">변경: {entry.changedFields.join(', ')}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </ModalShell>
  );
}

export default ChangeHistoryModal;

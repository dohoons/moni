import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDialogViewport } from '../hooks/useDialogViewport';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import {
  clearChangeHistory,
  getChangeHistory,
  type ChangeHistoryEntry,
} from '../services/change-history';
import { showAlert, showConfirm } from '../services/message-dialog';
import ModalShell from './ModalShell';

interface ChangeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (entry: ChangeHistoryEntry) => Promise<void>;
}

function ChangeHistoryModal({ isOpen, onClose, onRestore }: ChangeHistoryModalProps) {
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { isMobile, keyboardInset } = useDialogViewport(isOpen);
  const { panelRef, panelStyle, panelTouch } = usePullDownToClose({ onClose, enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      setEntries(getChangeHistory());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dialogStyle: CSSProperties = {
    ...panelStyle,
    marginBottom: isMobile ? keyboardInset : undefined,
    maxHeight: isMobile ? `calc(100dvh - ${8 + keyboardInset}px)` : undefined,
  };

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
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      panelClassName="flex w-full max-w-lg max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl"
      panelRef={panelRef}
      panelStyle={dialogStyle}
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
                <div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {renderActionLabel(entry.action)}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRestore(entry)}
                  disabled={!canRestore(entry) || restoringId === entry.id}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {restoringId === entry.id ? '복원 중' : '복원'}
                </button>
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

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../services/api';
import { getPendingRecords, clearPendingRecords, removePendingRecordByIndex, getPendingRecordByIndex, removePendingRecord, updateLastSyncTime, isOnline } from '../services/sync';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import { useDialogViewport } from '../hooks/useDialogViewport';
import { showAlert, showConfirm } from '../services/message-dialog';
import { getTodayDate } from '../lib/date';
import ModalShell from './ModalShell';

interface SyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  onRecordsUpdated?: () => void;
}

/**
 * 동기화 대기열 관리 모달
 *
 * - 대기열 목록 표시
 * - 개별 작업 취소
 * - 전체 취소
 */
function SyncQueueModal({ isOpen, onClose, onAfterClose, onRecordsUpdated }: SyncQueueModalProps) {
  const [records, setRecords] = useState(getPendingRecords());
  const [syncingIndex, setSyncingIndex] = useState<number | null>(null);
  const { isMobile, keyboardInset } = useDialogViewport(isOpen);
  const { panelRef, panelStyle, panelTouch } = usePullDownToClose({ onClose, enabled: isOpen });

  // 모달이 열릴 때마다 레코드 새로고침
  useEffect(() => {
    if (isOpen) {
      setRecords(getPendingRecords());
    }
  }, [isOpen]);

  const refreshRecords = () => {
    setRecords(getPendingRecords());
  };

  // 개별 동기화
  const handleSyncOne = async (index: number) => {
    if (!isOnline()) {
      await showAlert('오프라인 상태입니다. 네트워크 연결을 확인해주세요.');
      return;
    }

    const record = getPendingRecordByIndex(index);
    if (!record) return;

    setSyncingIndex(index);

    try {
      if (record.action === 'delete') {
        await api.deleteRecord(record.id);
      } else if (record.action === 'update') {
        await api.updateRecord(record.id, {
          amount: record.data.amount,
          date: record.data.date,
          memo: record.data.memo ?? null,
          method: (record.data.method ?? null) as any,
          category: record.data.category ?? null,
        });
      } else {
        await api.createRecord({
          amount: record.data.amount ?? 0,
          date: record.data.date ?? getTodayDate(),
          memo: record.data.memo ?? null,
          method: (record.data.method ?? null) as any,
          category: record.data.category ?? null,
        });
      }

      // 성공하면 대기열에서 제거
      removePendingRecord(record.id);
      updateLastSyncTime();
      refreshRecords();
      onRecordsUpdated?.();
    } catch (error: any) {
      console.error('Failed to sync record:', error);
      await showAlert(`동기화 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setSyncingIndex(null);
    }
  };

  const handleRemove = (index: number) => {
    removePendingRecordByIndex(index);
    refreshRecords();
    onRecordsUpdated?.();
  };

  const handleClearAll = async () => {
    if (
      await showConfirm('모든 대기 작업을 취소하시겠습니까?', {
        primaryLabel: '전체 취소',
        secondaryLabel: '닫기',
        tone: 'danger',
      })
    ) {
      clearPendingRecords();
      refreshRecords();
      onRecordsUpdated?.();
    }
  };

  const dialogStyle: CSSProperties = {
    ...panelStyle,
    marginBottom: isMobile ? keyboardInset : undefined,
    maxHeight: isMobile ? `calc(100dvh - ${8 + keyboardInset}px)` : undefined,
  };

  const getActionLabel = (action?: string) => {
    switch (action) {
      case 'create':
        return '새 기록';
      case 'update':
        return '수정';
      case 'delete':
        return '삭제';
      default:
        return '기록';
    }
  };

  const getActionEmoji = (action?: string) => {
    switch (action) {
      case 'create':
        return '➕';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderRecordDetails = (record: { id: string; action?: string; data: any }) => {
    const { action, data } = record;

    if (action === 'delete') {
      // 삭제 대상의 정보가 있으면 표시
      if (data.amount !== undefined || data.memo || data.date) {
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              ID: <span className="font-mono">{record.id}</span>
            </div>
            {data.date && (
              <div className="text-xs text-gray-600">
                📅 {formatDate(data.date)}
              </div>
            )}
            {data.amount !== undefined && (
              <div className="text-xs text-gray-600">
                💰 {data.amount > 0 ? '+' : ''}{data.amount?.toLocaleString()}원
              </div>
            )}
            {data.memo && (
              <div className="text-xs text-gray-600">
                📝 {data.memo}
              </div>
            )}
            {(data.category || data.method) && (
              <div className="flex gap-2 text-xs">
                {data.category && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                    #{data.category}
                  </span>
                )}
                {data.method && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    {data.method}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
      // 정보가 없는 경우 (기존 데이터)
      return (
        <div className="text-xs text-gray-600">
          <span className="font-mono text-gray-400">{record.id}</span>
          <span className="ml-2">기록 삭제</span>
        </div>
      );
    }

    if (action === 'update') {
      return (
        <div className="space-y-1">
          <div className="text-xs text-gray-500">
            ID: <span className="font-mono">{record.id}</span>
          </div>
          {data.date && (
            <div className="text-xs text-gray-600">
              📅 {formatDate(data.date)}
            </div>
          )}
          <div className="text-xs text-gray-600">
            💰 {data.amount > 0 ? '+' : ''}{data.amount?.toLocaleString()}원
          </div>
          {data.memo && (
            <div className="text-xs text-gray-600">
              📝 {data.memo}
            </div>
          )}
        </div>
      );
    }

    // create
    return (
      <div className="space-y-1">
        {data.date && (
          <div className="text-xs text-gray-600">
            📅 {formatDate(data.date)}
          </div>
        )}
        <div className="text-xs text-gray-600">
          💰 {data.amount > 0 ? '+' : ''}{data.amount?.toLocaleString()}원
        </div>
        {data.memo && (
          <div className="text-xs text-gray-600">
            📝 {data.memo}
          </div>
        )}
        {(data.category || data.method) && (
          <div className="flex gap-2 text-xs">
            {data.category && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                #{data.category}
              </span>
            )}
            {data.method && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                {data.method}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
  };

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      panelClassName="flex w-full max-w-none max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100vh-2rem)] sm:max-w-md sm:rounded-2xl"
      panelRef={panelRef}
      panelStyle={dialogStyle}
      panelProps={panelTouch}
    >
        <div className="flex justify-center px-6 pt-3 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            동기화 대기열 ({records.length}개)
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {records.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              대기 중인 작업이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => {
                const isSyncing = syncingIndex === index;
                return (
                  <div
                    key={record.id}
                    className="flex items-start justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-sm">{getActionEmoji(record.action)}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {getActionLabel(record.action)}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(record.timestamp)}
                        </span>
                      </div>
                      {renderRecordDetails(record)}
                    </div>
                    <div className="ml-3 mt-1 flex flex-col gap-2">
                      <button
                        onClick={() => handleSyncOne(index)}
                        disabled={isSyncing || !isOnline()}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSyncing || !isOnline()
                            ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400'
                            : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {isSyncing ? '동기화 중...' : '동기화'}
                      </button>
                      <button
                        onClick={() => handleRemove(index)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-red-600"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && (
          <div className="border-t border-gray-200 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:py-4">
            <button
              onClick={handleClearAll}
              className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              모두 취소
            </button>
          </div>
        )}
    </ModalShell>
  );
}

export default SyncQueueModal;

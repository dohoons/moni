import { useCallback } from 'react';
import { useSync } from './useSync';
import type { ParsedInput } from '../lib/parser';
import {
  appendChangeHistory,
  buildAfterSnapshot,
  HISTORY_FIELDS,
  toHistorySnapshot,
  toParsedInput,
  type ChangeHistoryEntry,
  type HistoryRecordSnapshot,
} from '../services/change-history';
import { showAlert, showConfirm } from '../services/message-dialog';
import type { Record as TransactionRecord } from '../components/DetailEntry';

type RecordLike = TransactionRecord & { updated?: string };

const getChangedFields = (before: HistoryRecordSnapshot, after: HistoryRecordSnapshot) => {
  return HISTORY_FIELDS.filter((field) => before[field] !== after[field]);
};

interface CreateWithHistoryInput {
  parsed: ParsedInput;
  date?: string;
  tempId?: string;
  historyAfterSnapshot?: HistoryRecordSnapshot;
}

interface RestoreOptions {
  onRestored?: () => Promise<void> | void;
}

export function useRecordsController() {
  const sync = useSync();
  const {
    createRecord: baseCreateRecord,
    updateRecord: baseUpdateRecord,
    deleteRecord: baseDeleteRecord,
  } = sync;

  const createRecord = useCallback(
    async ({ parsed, date, tempId, historyAfterSnapshot }: CreateWithHistoryInput) => {
      const result = await baseCreateRecord({ ...parsed, date }, tempId);

      if (!result.queued && historyAfterSnapshot) {
        const createdId = result.createdId || historyAfterSnapshot.id;
        appendChangeHistory({
          action: 'create',
          recordId: createdId,
          before: null,
          after: { ...historyAfterSnapshot, id: createdId },
          changedFields: ['신규'],
        });
      }

      return result;
    },
    [baseCreateRecord]
  );

  const updateRecord = useCallback(
    async (id: string, parsed: Partial<ParsedInput>, date: string, beforeSnapshot?: HistoryRecordSnapshot | null) => {
      const result = await baseUpdateRecord(id, { ...parsed, date });

      if (beforeSnapshot) {
        const afterSnapshot = buildAfterSnapshot(beforeSnapshot, parsed, date);
        appendChangeHistory({
          action: 'update',
          recordId: id,
          before: beforeSnapshot,
          after: afterSnapshot,
          changedFields: getChangedFields(beforeSnapshot, afterSnapshot),
        });
      }

      return result;
    },
    [baseUpdateRecord]
  );

  const deleteRecord = useCallback(
    async (id: string, beforeSnapshot?: HistoryRecordSnapshot | null) => {
      const result = await baseDeleteRecord(id);

      if (beforeSnapshot) {
        appendChangeHistory({
          action: 'delete',
          recordId: id,
          before: beforeSnapshot,
          after: null,
          changedFields: ['삭제'],
        });
      }

      return result;
    },
    [baseDeleteRecord]
  );

  const restoreHistory = useCallback(
    async (entry: ChangeHistoryEntry, options?: RestoreOptions) => {
      const confirmed = await showConfirm('선택한 변경을 복원하시겠습니까?', {
        primaryLabel: '복원',
        secondaryLabel: '취소',
      });

      if (!confirmed) {
        return;
      }

      if (entry.action === 'update') {
        if (!entry.before) {
          throw new Error('복원할 이전 데이터가 없습니다.');
        }

        const result = await baseUpdateRecord(entry.recordId, {
          ...toParsedInput(entry.before),
          date: entry.before.date,
        });
        if (result.queued) {
          await showAlert('오프라인 상태입니다. 복원 작업이 동기화 대기열에 추가되었습니다.');
        }
      } else if (entry.action === 'delete') {
        if (!entry.before) {
          throw new Error('복원할 삭제 데이터가 없습니다.');
        }

        const result = await baseCreateRecord({
          ...toParsedInput(entry.before),
          date: entry.before.date,
        });
        if (result.queued) {
          await showAlert('오프라인 상태입니다. 복원 작업이 동기화 대기열에 추가되었습니다.');
        }
      } else {
        const result = await baseDeleteRecord(entry.recordId);
        if (result.queued) {
          await showAlert('오프라인 상태입니다. 복원 작업이 동기화 대기열에 추가되었습니다.');
        }
      }

      await options?.onRestored?.();
      await showAlert('선택한 변경을 복원했습니다.');
    },
    [baseCreateRecord, baseDeleteRecord, baseUpdateRecord]
  );

  const toSnapshot = useCallback((record: RecordLike) => toHistorySnapshot(record), []);

  return {
    ...sync,
    createRecord,
    updateRecord,
    deleteRecord,
    restoreHistory,
    toSnapshot,
  };
}

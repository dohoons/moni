import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { ParsedInput } from '../lib/parser';
import {
  getPendingRecords,
  addPendingRecord,
  removePendingRecord,
  getPendingCount,
  isOnline,
  onOnlineStatusChange,
  updateLastSyncTime,
} from '../services/sync';

interface UseSyncResult {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  createRecord: (data: ParsedInput) => Promise<{ queued?: boolean; tempId?: string }>;
  updateRecord: (id: string, data: Partial<ParsedInput> & { date?: string }) => Promise<{ queued?: boolean }>;
  deleteRecord: (id: string) => Promise<{ queued?: boolean }>;
}

/**
 * 오프라인 동기화 Hook (React Query)
 *
 * - 온라인/오프라인 상태 추적
 * - 오프라인 시 기록을 대기열에 추가
 * - 온라인 시 자동 동기화
 * - 수동 동기화 기능
 * - Mutation 성공 시 자동 캐시 무효화
 */
export function useSync(): UseSyncResult {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);

  // 대기열 동기화 (내부 함수)
  const syncPending = useCallback(async () => {
    if (isSyncingRef.current || !isOnline()) {
      return;
    }

    const pending = getPendingRecords();
    if (pending.length === 0) {
      return;
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      for (const record of pending) {
        try {
          if (record.action === 'delete') {
            await api.deleteRecord(record.id);
          } else if (record.action === 'update') {
            await api.updateRecord(record.id, {
              amount: record.data.amount,
              date: record.data.date,
              memo: record.data.memo ?? null,
              method: (record.data.method ?? null) as ParsedInput['method'],
              category: record.data.category ?? null,
            });
          } else {
            await api.createRecord({
              amount: record.data.amount ?? 0,
              date: record.data.date ?? new Date().toISOString().split('T')[0],
              memo: record.data.memo ?? null,
              method: (record.data.method ?? null) as ParsedInput['method'],
              category: record.data.category ?? null,
            });
          }
          removePendingRecord(record.id);
        } catch (error) {
          console.error(`Failed to sync record ${record.id}:`, error);
        }
      }

      updateLastSyncTime();

      // 캐시 무효화하여 데이터 갱신
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient]);

  // createRecord Mutation
  const createRecordMutation = useMutation({
    mutationFn: async (data: ParsedInput & { tempId: string }) => {
      const date = new Date().toISOString().split('T')[0];

      if (isOnline()) {
        await api.createRecord({
          amount: data.amount,
          date,
          memo: data.memo ?? null,
          method: data.method ?? null,
          category: data.category ?? null,
        });
        return { queued: false, tempId: data.tempId };
      } else {
        const id = addPendingRecord({
          amount: data.amount,
          date,
          memo: data.memo ?? null,
          method: data.method ?? null,
          category: data.category ?? null,
        });
        return { queued: true, tempId: data.tempId, pendingId: id };
      }
    },
    onSuccess: () => {
      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  // updateRecord Mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ParsedInput> & { date?: string } }) => {
      if (isOnline()) {
        await api.updateRecord(id, data);
        return { queued: false };
      } else {
        addPendingRecord({
          id,
          action: 'update',
          amount: data.amount,
          date: data.date,
          memo: data.memo ?? null,
          method: data.method ?? null,
          category: data.category ?? null,
        });
        return { queued: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  // deleteRecord Mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isOnline()) {
        await api.deleteRecord(id);
        return { queued: false };
      } else {
        addPendingRecord({ id, action: 'delete' });
        return { queued: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });

  // 온라인 상태 변경 감지
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((isOnlineStatus) => {
      const wasOffline = !online;
      setOnline(isOnlineStatus);

      // 오프라인 → 온라인으로 전환되고, 대기열이 있으면 동기화
      if (wasOffline && isOnlineStatus && getPendingCount() > 0 && !isSyncingRef.current) {
        syncPending();
      }
    });

    return unsubscribe;
  }, [online, syncPending]);

  // 수동 동기화
  const syncNow = useCallback(async () => {
    await syncPending();
  }, [syncPending]);

  // 래퍼 함수 (Mutation 호출)
  const createRecord = useCallback(
    async (data: ParsedInput) => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return createRecordMutation.mutateAsync({ ...data, tempId });
    },
    [createRecordMutation]
  );

  const updateRecord = useCallback(
    async (id: string, data: Partial<ParsedInput> & { date?: string }) => {
      return updateRecordMutation.mutateAsync({ id, data });
    },
    [updateRecordMutation]
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      return deleteRecordMutation.mutateAsync(id);
    },
    [deleteRecordMutation]
  );

  return {
    isOnline: online,
    pendingCount: getPendingCount(),
    isSyncing,
    syncNow,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}

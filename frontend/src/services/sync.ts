/**
 * Offline Sync Service
 *
 * 오프라인 상태에서 기록을 대기열에 저장하고,
 * 온라인 시 자동으로 동기화
 */

interface PendingRecord {
  id: string;
  action?: 'create' | 'update' | 'delete';
  data: {
    amount?: number;
    date?: string;
    memo: string | null;
    method: string | null;
    category: string | null;
  };
  timestamp: number;
}

const STORAGE_KEY = 'moni_pending_records';
const SYNC_KEY = 'moni_last_sync';

/**
 * 대기열 가져오기
 */
export function getPendingRecords(): PendingRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * 대기열 저장
 */
function savePendingRecords(records: PendingRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/**
 * 대기열에 기록 추가
 */
export function addPendingRecord(record: {
  id?: string;
  action?: 'create' | 'update' | 'delete';
  amount?: number;
  date?: string;
  memo?: string | null;
  method?: string | null;
  category?: string | null;
}): string {
  const records = getPendingRecords();
  const id = record.id || `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const pendingRecord: PendingRecord = {
    id,
    action: record.action || 'create',
    data: {
      amount: record.amount,
      date: record.date,
      memo: record.memo ?? null,
      method: record.method ?? null,
      category: record.category ?? null,
    },
    timestamp: Date.now(),
  };

  records.push(pendingRecord);
  savePendingRecords(records);

  return id;
}

/**
 * 대기열에서 기록 제거
 */
export function removePendingRecord(id: string): void {
  const records = getPendingRecords();
  const filtered = records.filter(r => r.id !== id);
  savePendingRecords(filtered);
}

/**
 * 대기열 비우기
 */
export function clearPendingRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 마지막 동기화 시간 가져오기
 */
export function getLastSyncTime(): number | null {
  const time = localStorage.getItem(SYNC_KEY);
  return time ? parseInt(time) : null;
}

/**
 * 마지막 동기화 시간 업데이트
 */
export function updateLastSyncTime(): void {
  localStorage.setItem(SYNC_KEY, Date.now().toString());
}

/**
 * 대기열 크기 반환
 */
export function getPendingCount(): number {
  return getPendingRecords().length;
}

/**
 * 온라인 상태 확인
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * 온라인 상태 변경 리스너 등록
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);

  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

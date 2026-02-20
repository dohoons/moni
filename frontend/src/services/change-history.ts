import type { Record as TransactionRecord } from '../components/DetailEntry';
import type { ParsedInput } from '../lib/parser';

const STORAGE_KEY = 'moni_change_history_v1';
const MAX_ENTRIES = 200;

export type HistoryAction = 'create' | 'update' | 'delete';
export const HISTORY_FIELD_ENTRIES = [
  ['date', '날짜'],
  ['amount', '금액'],
  ['memo', '메모'],
  ['method', '결제수단'],
  ['category', '카테고리'],
] as const;
export type HistoryField = (typeof HISTORY_FIELD_ENTRIES)[number][0];
export const HISTORY_FIELDS: readonly HistoryField[] = HISTORY_FIELD_ENTRIES.map(([field]) => field);
export const HISTORY_FIELD_LABELS = Object.fromEntries(HISTORY_FIELD_ENTRIES) as Record<HistoryField, string>;

export interface HistoryRecordSnapshot {
  id: string;
  date: string;
  amount: number;
  memo: string;
  method: ParsedInput['method'];
  category: string | null;
  created?: string;
  updated?: string;
}

export interface ChangeHistoryEntry {
  id: string;
  action: HistoryAction;
  recordId: string;
  before: HistoryRecordSnapshot | null;
  after: HistoryRecordSnapshot | null;
  changedFields: Array<HistoryField | '신규' | '삭제'>;
  createdAt: string;
}

type RecordLike = TransactionRecord & {
  updated?: string;
};

export function toHistorySnapshot(record: RecordLike): HistoryRecordSnapshot {
  return {
    id: record.id,
    date: record.date,
    amount: record.amount,
    memo: record.memo || '',
    method: record.method || null,
    category: record.category || null,
    created: record.created,
    updated: record.updated,
  };
}

export function toParsedInput(snapshot: HistoryRecordSnapshot): ParsedInput {
  return {
    amount: snapshot.amount,
    memo: snapshot.memo || null,
    method: snapshot.method,
    category: snapshot.category || null,
  };
}

function readEntries(): ChangeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidHistoryEntry);
  } catch {
    return [];
  }
}

function writeEntries(entries: ChangeHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function isValidHistoryEntry(value: unknown): value is ChangeHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChangeHistoryEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.action === 'string' &&
    typeof candidate.recordId === 'string' &&
    Array.isArray(candidate.changedFields) &&
    typeof candidate.createdAt === 'string'
  );
}

export function getChangeHistory(): ChangeHistoryEntry[] {
  return readEntries().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendChangeHistory(
  input: Omit<ChangeHistoryEntry, 'id' | 'createdAt'> & { createdAt?: string }
) {
  const entries = readEntries();
  const entry: ChangeHistoryEntry = {
    ...input,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: input.createdAt || new Date().toISOString(),
  };
  entries.unshift(entry);
  writeEntries(entries);
}

export function clearChangeHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function removeChangeHistoryEntry(entryId: string) {
  const entries = readEntries().filter((entry) => entry.id !== entryId);
  writeEntries(entries);
}

export function buildAfterSnapshot(
  before: HistoryRecordSnapshot,
  parsed: Partial<ParsedInput>,
  date: string
): HistoryRecordSnapshot {
  return {
    ...before,
    date,
    amount: parsed.amount !== undefined ? parsed.amount : before.amount,
    memo: parsed.memo !== undefined ? parsed.memo || '' : before.memo,
    method: parsed.method !== undefined ? parsed.method : before.method,
    category: parsed.category !== undefined ? parsed.category : before.category,
  };
}

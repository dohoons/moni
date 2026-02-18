import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { overlay } from 'overlay-kit';
import DetailEntry, { type Record as TransactionRecord } from '../components/DetailEntry';
import RecordListItem from '../components/RecordListItem';
import { useRecordsController } from '../hooks/useRecordsController';
import { api } from '../services/api';
import { showAlert } from '../services/message-dialog';
import type { ParsedInput } from '../lib/parser';

type SearchRecord = TransactionRecord & {
  _isSaving?: boolean;
  _original?: TransactionRecord;
};

const PAGE_SIZE = 40;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function Search() {
  const navigate = useNavigate();
  const { updateRecord, deleteRecord, toSnapshot } = useRecordsController();

  const [queryInput, setQueryInput] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titleBarBottom, setTitleBarBottom] = useState(() => {
    return document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  const executeSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      await showAlert('검색어를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchedQuery(trimmed);

    try {
      const response = await api.searchRecords({
        q: trimmed,
        fields: ['memo'],
        limit: PAGE_SIZE,
      });

      const nextRecords = (response.data || []) as SearchRecord[];
      setRecords(nextRecords);

      if (nextRecords.length === PAGE_SIZE) {
        const lastRecord = nextRecords[nextRecords.length - 1];
        setCursor(`${lastRecord.date}|${lastRecord.id}`);
      } else {
        setCursor(null);
      }
    } catch (err: unknown) {
      console.error('Failed to search records:', err);
      setError(getErrorMessage(err, '검색 중 오류가 발생했습니다.'));
      setRecords([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useEffectEvent(async () => {
    if (!searchedQuery || !cursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const response = await api.searchRecords({
        q: searchedQuery,
        fields: ['memo'],
        limit: PAGE_SIZE,
        cursor,
      });

      const nextRecords = (response.data || []) as SearchRecord[];
      if (nextRecords.length === 0) {
        setCursor(null);
        return;
      }

      if (nextRecords.length === PAGE_SIZE) {
        const lastRecord = nextRecords[nextRecords.length - 1];
        setCursor(`${lastRecord.date}|${lastRecord.id}`);
      } else {
        setCursor(null);
      }
      setRecords((prev) => [...prev, ...nextRecords]);
    } catch (err: unknown) {
      console.error('Failed to load more search results:', err);
      setError(getErrorMessage(err, '검색 결과를 더 불러오지 못했습니다.'));
      setCursor(null);
    } finally {
      setLoadingMore(false);
    }
  });

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !cursor || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMore();
        }
      },
      { threshold: 0 }
    );

    observer.observe(target);
    return () => observer.unobserve(target);
  }, [cursor, loadingMore]);

  useEffect(() => {
    const updateTitleBarBottom = () => {
      const nextBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
      setTitleBarBottom((prev) => (Math.abs(prev - nextBottom) > 0.5 ? nextBottom : prev));
    };

    updateTitleBarBottom();
    window.addEventListener('resize', updateTitleBarBottom);
    window.addEventListener('orientationchange', updateTitleBarBottom);
    return () => {
      window.removeEventListener('resize', updateTitleBarBottom);
      window.removeEventListener('orientationchange', updateTitleBarBottom);
    };
  }, []);

  const handleUpdate = async (id: string, parsed: Partial<ParsedInput>, date: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    setRecords((old) =>
      old.map((record) => (record.id === id ? { ...record, _original: { ...record }, _isSaving: true } : record))
    );

    setRecords((old) =>
      old.map((record) =>
        record.id === id
          ? {
              ...record,
              amount: parsed.amount !== undefined ? parsed.amount : record.amount,
              memo: parsed.memo !== undefined ? parsed.memo || '' : record.memo,
              method: parsed.method !== undefined ? parsed.method : record.method,
              category: parsed.category !== undefined ? parsed.category : record.category,
              date,
              _isSaving: true,
            }
          : record
      )
    );

    try {
      const result = await updateRecord(id, parsed, date, beforeSnapshot);
      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      setRecords((old) => {
        const loweredQuery = searchedQuery.toLowerCase();

        return old
          .map((record) =>
            record.id === id
              ? {
                  ...record,
                  _isSaving: false,
                  _original: undefined,
                }
              : record
          )
          .filter((record) => record.memo.toLowerCase().includes(loweredQuery));
      });
    } catch (err: unknown) {
      console.error('Failed to update record:', err);
      await showAlert('기록 수정에 실패했습니다: ' + getErrorMessage(err, '알 수 없는 오류'));

      setRecords((old) =>
        old.map((record) =>
          record._original && record.id === id
            ? { ...record._original, _isSaving: false }
            : record
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    setRecords((old) =>
      old.map((record) => (record.id === id ? { ...record, _original: { ...record }, _isSaving: true } : record))
    );

    try {
      const result = await deleteRecord(id, beforeSnapshot);
      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      setRecords((old) => old.filter((record) => record.id !== id));
    } catch (err: unknown) {
      console.error('Failed to delete record:', err);
      await showAlert('기록 삭제에 실패했습니다: ' + getErrorMessage(err, '알 수 없는 오류'));

      setRecords((old) =>
        old.map((record) =>
          record._original && record.id === id
            ? { ...record._original, _isSaving: false }
            : record
        )
      );
    }
  };

  const openDetailEntry = ({ editRecord }: { editRecord: SearchRecord }) =>
    overlay.openAsync<void>(({ isOpen, close, unmount }) => (
      <DetailEntry
        isOpen={isOpen}
        editRecord={editRecord}
        onClose={() => close(undefined)}
        onAfterClose={unmount}
        onSubmit={() => {}}
        onUpdate={(id, parsed, date) => {
          close(undefined);
          void handleUpdate(id, parsed, date);
        }}
        onDelete={(id) => {
          close(undefined);
          void handleDelete(id);
        }}
      />
    ));

  const handleRecordClick = (record: SearchRecord) => {
    void openDetailEntry({ editRecord: record });
  };

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: SearchRecord[] } = {};
    records.forEach((record) => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
    });

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed left-0 right-0 top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur safe-area-top">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => navigate('/')}
              aria-label="뒤로가기"
              className="absolute left-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">검색</h1>
            <div className="absolute right-0 h-10 w-10" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 safe-area-header pb-24 sm:px-6">
        <section
          className="sticky z-[2] mb-6 -mx-1 bg-gray-50 px-1 pb-2"
          style={{ top: `${titleBarBottom + 8}px` }}
        >
          <form
            className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void executeSearch(queryInput);
            }}
          >
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="메모 검색"
              className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              검색
            </button>
          </form>
        </section>

        {!searchedQuery && !loading && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">메모 검색어를 입력한 뒤 검색 버튼을 눌러주세요.</p>
          </div>
        )}

        {loading && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">검색 중...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => void executeSearch(searchedQuery || queryInput)}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && searchedQuery && records.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">일치하는 기록이 없습니다.</p>
          </div>
        )}

        {!loading && records.length > 0 && (
          <section>
            <div className="mb-4 mt-6 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                "{searchedQuery}" 검색 결과
              </h2>
              <span className="text-xs text-gray-500">{records.length}건</span>
            </div>

            <div className="space-y-6">
              {groupedRecords.map(([date, dateRecords]) => (
                <div key={date}>
                  <h3 className="mb-3 px-1 text-sm font-semibold text-gray-500">{date}</h3>
                  <div className="space-y-2">
                    {dateRecords.map((record) => (
                      <RecordListItem
                        key={record.id}
                        record={record}
                        onClick={handleRecordClick}
                        variant="archive"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div ref={observerTarget} className="h-10" />

            {loadingMore && (
              <div className="py-3 text-center text-sm text-gray-500">더 불러오는 중...</div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default Search;

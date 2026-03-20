import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { overlay } from 'overlay-kit';
import DetailEntry, { type Record as TransactionRecord } from '../components/DetailEntry';
import ChangeHistoryModal from '../components/ChangeHistoryModal';
import RecordListItem from '../components/RecordListItem';
import SkeletonItem from '../components/SkeletonItem';
import RefreshFab from '../components/RefreshFab';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { useRecordsController } from '../hooks/useRecordsController';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { api } from '../services/api';
import { formatDate } from '../lib/date';
import type { ParsedInput } from '../lib/parser';
import { getMonthRange } from '../lib/date';
import { showAlert } from '../services/message-dialog';
import YearMonthPickerModal from '../components/YearMonthPickerModal';

const getCurrentYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

type ArchiveRecord = TransactionRecord & {
  _isSaving?: boolean;
  _original?: TransactionRecord;
};

const isDateInCurrentMonth = (date: string, yearMonth: { year: number; month: number }) => {
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return false;
  return target.getFullYear() === yearMonth.year && target.getMonth() + 1 === yearMonth.month;
};

const MONTH_FETCH_LIMIT = 99999;
const STICKY_TITLEBAR_GAP = 8;

function Archive() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const now = new Date();
  const defaultYear = now.getFullYear();
  const {
    updateRecord,
    deleteRecord,
    restoreHistory,
    toSnapshot,
  } = useRecordsController();
  const [yearMonth, setYearMonth] = useState(() => {
    const current = getCurrentYearMonth();
    const urlYear = Number(searchParams.get('year'));
    const urlMonth = Number(searchParams.get('month'));
    const year = Number.isInteger(urlYear) && urlYear >= 2000 && urlYear <= 9999 ? urlYear : current.year;
    const month = Number.isInteger(urlMonth) && urlMonth >= 1 && urlMonth <= 12 ? urlMonth : current.month;
    return { year, month };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const monthSummaryRef = useRef<HTMLDivElement>(null);
  const [stickyOffsets, setStickyOffsets] = useState(() => {
    const titleBarBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
    return {
      titleBarBottom,
      dayHeadingTop: titleBarBottom + STICKY_TITLEBAR_GAP + 112,
    };
  });

  const {
    data: records = [],
    isPending,
    error,
    refetch: loadRecords,
  } = useQuery<ArchiveRecord[]>({
    queryKey: ['archive', yearMonth.year, yearMonth.month],
    queryFn: async () => {
      const { startDate, endDate } = getMonthRange(yearMonth.year, yearMonth.month);
      const response = await api.getRecords({
        startDate,
        endDate,
        limit: MONTH_FETCH_LIMIT,
      });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });

  const {
    refreshSource,
    pullDistance,
    handleManualRefresh,
    handleMainTouchStart,
    handleMainTouchMove,
    handleMainTouchEnd,
  } = usePullToRefresh({
    onRefresh: async () => { await loadRecords(); },
    isRefreshing,
    isLoading: isPending,
    setIsRefreshing,
  });

  useEffect(() => {
    const currentYear = searchParams.get('year');
    const currentMonth = searchParams.get('month');
    const nextYear = String(yearMonth.year);
    const nextMonth = String(yearMonth.month);

    if (currentYear === nextYear && currentMonth === nextMonth) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('year', nextYear);
    nextParams.set('month', nextMonth);
    setSearchParams(nextParams, { replace: true });
  }, [yearMonth.year, yearMonth.month, searchParams, setSearchParams]);

  useEffect(() => {
    const updateStickyOffsets = () => {
      const titleBarBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
      const monthSummaryHeight = monthSummaryRef.current?.offsetHeight ?? 112;

      setStickyOffsets((prev) => {
        const next = {
          titleBarBottom,
          dayHeadingTop: titleBarBottom + monthSummaryHeight + STICKY_TITLEBAR_GAP,
        };
        if (
          Math.abs(prev.titleBarBottom - next.titleBarBottom) <= 0.5 &&
          Math.abs(prev.dayHeadingTop - next.dayHeadingTop) <= 0.5
        ) {
          return prev;
        }
        return next;
      });
    };

    updateStickyOffsets();
    window.addEventListener('resize', updateStickyOffsets);
    window.addEventListener('orientationchange', updateStickyOffsets);
    return () => {
      window.removeEventListener('resize', updateStickyOffsets);
      window.removeEventListener('orientationchange', updateStickyOffsets);
    };
  }, [yearMonth.year, yearMonth.month, records.length]);

  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: ArchiveRecord[] } = {};
    records.forEach((record) => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  const handlePrevMonth = () => {
    setYearMonth((prev) => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
      return { year: newYear, month: newMonth };
    });
  };

  const handleNextMonth = () => {
    setYearMonth((prev) => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      return { year: newYear, month: newMonth };
    });
  };
  const years = useMemo(() => {
    const recentYears = Array.from({ length: 7 }, (_, i) => defaultYear - i);
    if (recentYears.includes(yearMonth.year)) {
      return recentYears;
    }
    return [...recentYears, yearMonth.year].sort((a, b) => b - a);
  }, [defaultYear, yearMonth.year]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const openMonthPicker = async () => {
    const selection = await overlay.openAsync<{ year: number; month: number } | null>(
      ({ isOpen, close, unmount }) => (
        <YearMonthPickerModal
          isOpen={isOpen}
          initialYear={yearMonth.year}
          initialMonth={yearMonth.month}
          years={years}
          months={months}
          onClose={() => close(null)}
          onAfterClose={unmount}
          onApply={(next) => close(next)}
        />
      )
    );

    if (!selection) return;
    setYearMonth(selection);
  };

  const monthlyTotal = useMemo(() => {
    return records.reduce((sum, record) => sum + record.amount, 0);
  }, [records]);

  const handleUpdate = async (id: string, parsed: Partial<ParsedInput>, date: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    // 원본 레코드 저장 (롤백용)
    queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
      old.map(r => r.id === id ? { ...r, _original: { ...r }, _isSaving: true } : r)
    );

    // 낙관적 업데이트: 즉시 반영
    queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
      old.map(r => {
        if (r.id === id) {
          return {
            ...r,
            amount: parsed.amount !== undefined ? parsed.amount : r.amount,
            memo: parsed.memo !== undefined ? (parsed.memo || '') : r.memo,
            method: parsed.method !== undefined ? parsed.method : r.method,
            category: parsed.category !== undefined ? parsed.category : r.category,
            date,
            _isSaving: true,
          };
        }
        return r;
      })
    );

    try {
      const result = await updateRecord(id, parsed, date, beforeSnapshot);

      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      // 저장 완료 후 로딩 상태 제거
      queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
        old.map(r => r.id === id ? { ...r, _isSaving: false, _original: undefined } : r)
      );

      // 다른 월로 이동한 경우 데이터 다시 로딩
      if (!isDateInCurrentMonth(date, yearMonth)) {
        await loadRecords();
      }
    } catch (error) {
      console.error('Failed to update record:', error);
      await showAlert('기록 수정에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
      // 실패 시 롤백
      queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
        old.map(r => r._original && r.id === id ? r._original : r)
      );
    }
  };

  const handleDelete = async (id: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    // 원본 레코드 저장 (롤백용) + 로딩 상태 표시
    queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
      old.map(r => r.id === id ? { ...r, _original: { ...r }, _isSaving: true } : r)
    );

    try {
      const result = await deleteRecord(id, beforeSnapshot);

      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      // 성공 시 목록에서 완전히 제거
      queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
        old.filter(r => r.id !== id)
      );
    } catch (error) {
      console.error('Failed to delete record:', error);
      await showAlert('기록 삭제에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
      // 실패 시 롤백
      queryClient.setQueryData<ArchiveRecord[]>(['archive', yearMonth.year, yearMonth.month], (old = []) =>
        old.map(r => r._original && r.id === id ? { ...r._original, _isSaving: false } : r)
      );
    }
  };

  const openDetailEntry = (editRecord: ArchiveRecord) =>
    overlay.openAsync<void>(({ isOpen, close, unmount }) => (
      <DetailEntry
        isOpen={isOpen}
        editRecord={editRecord}
        initialParsed={null}
        onClose={() => close(undefined)}
        onAfterClose={unmount}
        onSubmit={() => undefined}
        onUpdate={(id, parsed, date) => {
          close(undefined);
          void handleUpdate(id, parsed, date);
        }}
        onDelete={(id) => {
          close(undefined);
          void handleDelete(id);
        }}
        showTemplateSaveButton={false}
      />
    ));

  const handleRecordClick = (record: ArchiveRecord) => {
    void openDetailEntry(record);
  };

  const openHistoryModal = () =>
    overlay.openAsync<void>(({ isOpen, close, unmount }) => (
      <ChangeHistoryModal
        isOpen={isOpen}
        onClose={() => close(undefined)}
        onAfterClose={unmount}
        onRestore={(entry) => restoreHistory(entry, { onRestored: async () => { await loadRecords(); } })}
      />
    ));

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
            <h1 className="text-center text-xl font-bold text-gray-900 sm:text-2xl">월별 보기</h1>
            <div className="absolute right-0 flex items-center gap-2">
              <button
                onClick={() => void openHistoryModal()}
                aria-label="이력"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5m6.5-2.5a9 9 0 11-3.2-6.9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-2xl px-4 safe-area-header pb-24 sm:px-6"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        onTouchCancel={handleMainTouchEnd}
      >
        {(pullDistance > 0 || (isRefreshing && refreshSource === 'pull')) && (
          <div className="mb-3 flex justify-center">
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
              {isRefreshing
                ? '새로고침 중...'
                : pullDistance >= 56
                  ? '손을 놓으면 새로고침'
                  : '아래로 당겨서 새로고침'}
            </div>
          </div>
        )}

        <div
          ref={monthSummaryRef}
          className="sticky z-[2] mb-6 rounded-xl bg-white p-4 shadow-sm"
          style={{ top: `${stickyOffsets.titleBarBottom + STICKY_TITLEBAR_GAP}px` }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void openMonthPicker()}
              className="rounded-lg px-4 py-1.5 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {yearMonth.year}년 {yearMonth.month}월
                </h2>
                <span className="mt-1 text-xs text-gray-500" aria-hidden="true">▼</span>
              </div>
              <p className={`mt-1 text-sm font-medium ${monthlyTotal >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                {monthlyTotal >= 0 ? '+' : ''}{monthlyTotal.toLocaleString()}원
              </p>
            </button>
            <button
              onClick={handleNextMonth}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {isPending ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-3 px-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: i % 2 + 2 }).map((_, j) => (
                    <SkeletonItem key={j} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={() => void handleManualRefresh()} />
        ) : records.length === 0 ? (
          <EmptyState message="이달의 기록이 없습니다." />
        ) : (
          <div className="space-y-6">
            {groupedRecords.map(([date, dateRecords]) => (
              <div key={date}>
                <div
                  className="sticky z-[1] bg-gray-50 pb-3 pt-3"
                  style={{ top: `${stickyOffsets.dayHeadingTop}px` }}
                >
                  <h4 className="px-1 text-sm font-semibold text-gray-500">{formatDate(date)}</h4>
                </div>
                <div className="space-y-2">
                  {dateRecords.map((record) => {
                    return (
                      <RecordListItem
                        key={record.id}
                        record={record}
                        onClick={handleRecordClick}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <RefreshFab isRefreshing={isRefreshing} isLoading={isPending} onRefresh={() => void handleManualRefresh()} />
    </div>
  );
}

export default Archive;

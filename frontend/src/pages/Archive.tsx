import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DetailEntry, { type Record as TransactionRecord } from '../components/DetailEntry';
import ChangeHistoryModal from '../components/ChangeHistoryModal';
import { useRecordsController } from '../hooks/useRecordsController';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import { useDialogViewport } from '../hooks/useDialogViewport';
import { api } from '../services/api';
import { WEEKDAYS } from '../constants';
import type { ParsedInput } from '../lib/parser';
import { showAlert } from '../services/message-dialog';
import ModalShell from '../components/ModalShell';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

const getCurrentYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

const getMonthRange = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: lastDay.toISOString().split('T')[0],
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
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailEntry, setShowDetailEntry] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editRecord, setEditRecord] = useState<TransactionRecord | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(yearMonth.year);
  const [draftMonth, setDraftMonth] = useState(yearMonth.month);
  const { isMobile, keyboardInset } = useDialogViewport(isMonthPickerOpen);
  const [pullDistance, setPullDistance] = useState(0);
  const monthSummaryRef = useRef<HTMLDivElement>(null);
  const [stickyOffsets, setStickyOffsets] = useState(() => {
    const titleBarBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 76;
    return {
      titleBarBottom,
      dayHeadingTop: titleBarBottom + STICKY_TITLEBAR_GAP + 112,
    };
  });
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const loadRecords = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const { startDate, endDate } = getMonthRange(yearMonth.year, yearMonth.month);
        const response = await api.getRecords({
          startDate,
          endDate,
          limit: MONTH_FETCH_LIMIT,
        });

        setRecords((response.data || []) as ArchiveRecord[]);
      } catch (error: any) {
        console.error('Failed to load records:', error);
        setError(error.message || '기록을 불러오는데 실패했습니다.');
        setRecords([]);
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [yearMonth.year, yearMonth.month]
  );

  useEffect(() => {
    void loadRecords(false);
  }, [loadRecords]);

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

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing || loading) return;
    await loadRecords(true);
  }, [isRefreshing, loading, loadRecords]);

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
  const openMonthPicker = () => {
    setDraftYear(yearMonth.year);
    setDraftMonth(yearMonth.month);
    setIsMonthPickerOpen(true);
  };

  const applyMonthPicker = () => {
    setYearMonth({ year: draftYear, month: draftMonth });
    setIsMonthPickerOpen(false);
  };

  const years = useMemo(() => {
    const recentYears = Array.from({ length: 7 }, (_, i) => defaultYear - i);
    if (recentYears.includes(yearMonth.year)) {
      return recentYears;
    }
    return [...recentYears, yearMonth.year].sort((a, b) => b - a);
  }, [defaultYear, yearMonth.year]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const {
    panelRef: monthPickerRef,
    panelStyle: monthPickerStyle,
    panelTouch: monthPickerPanelTouch,
  } = usePullDownToClose({
    onClose: () => setIsMonthPickerOpen(false),
    enabled: isMonthPickerOpen,
  });
  const monthPickerDialogStyle: CSSProperties = {
    ...monthPickerStyle,
    marginBottom: isMobile ? keyboardInset : undefined,
    maxHeight: isMobile ? `calc(100dvh - ${8 + keyboardInset}px)` : undefined,
  };

  useEffect(() => {
    if (!isMonthPickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMonthPickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMonthPickerOpen]);

  const monthlyTotal = useMemo(() => {
    return records.reduce((sum, record) => sum + record.amount, 0);
  }, [records]);

  const handleUpdate = async (id: string, parsed: Partial<ParsedInput>, date: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    setShowDetailEntry(false);
    setEditRecord(null);

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

      if (!isDateInCurrentMonth(date, yearMonth)) {
        await loadRecords(true);
        return;
      }

      setRecords((old) =>
        old.map((record) => (record.id === id ? { ...record, _isSaving: false, _original: undefined } : record))
      );
    } catch (error: any) {
      console.error('Failed to update record:', error);
      await showAlert('기록 수정에 실패했습니다: ' + error.message);
      setRecords((old) =>
        old.map((record) =>
          record.id === id && record._original
            ? { ...record._original, _isSaving: false, _original: undefined }
            : record
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    const targetRecord = records.find((record) => record.id === id);
    const beforeSnapshot = targetRecord ? toSnapshot(targetRecord) : null;

    setShowDetailEntry(false);
    setEditRecord(null);

    setRecords((old) =>
      old.map((record) => (record.id === id ? { ...record, _original: { ...record }, _isSaving: true } : record))
    );

    try {
      const result = await deleteRecord(id, beforeSnapshot);
      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      setRecords((old) => old.filter((record) => record.id !== id));
    } catch (error: any) {
      console.error('Failed to delete record:', error);
      await showAlert('기록 삭제에 실패했습니다: ' + error.message);
      setRecords((old) =>
        old.map((record) =>
          record.id === id && record._original
            ? { ...record._original, _isSaving: false, _original: undefined }
            : record
        )
      );
    }
  };

  const handleRecordClick = (record: ArchiveRecord) => {
    setEditRecord(record);
    setShowDetailEntry(true);
  };

  const handleModalClose = () => {
    setShowDetailEntry(false);
    setEditRecord(null);
  };

  const handleMainTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (window.scrollY > 2 || isRefreshing || loading) return;
      if (e.touches.length !== 1) return;

      pullStartYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    },
    [isRefreshing, loading]
  );

  const handleMainTouchMove = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (pullStartYRef.current === null) return;
    if (window.scrollY > 2) return;

    const deltaY = e.touches[0].clientY - pullStartYRef.current;
    if (deltaY <= 0) return;

    isPullingRef.current = true;
    const nextDistance = Math.min(96, deltaY * 0.45);
    setPullDistance(nextDistance);

    if (e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const handleMainTouchEnd = useCallback(() => {
    const shouldRefresh = isPullingRef.current && pullDistance >= 56;

    pullStartYRef.current = null;
    isPullingRef.current = false;
    setPullDistance(0);

    if (shouldRefresh) {
      void handleManualRefresh();
    }
  }, [pullDistance, handleManualRefresh]);

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
                onClick={() => setShowHistoryModal(true)}
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
        {(pullDistance > 0 || isRefreshing) && (
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
              onClick={openMonthPicker}
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

        <ModalShell
          open={isMonthPickerOpen}
          onBackdropClick={() => setIsMonthPickerOpen(false)}
          overlayClassName="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4"
          panelClassName="flex w-full max-w-none max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100vh-2rem)] sm:max-w-sm sm:rounded-2xl"
          panelRef={monthPickerRef}
          panelStyle={monthPickerDialogStyle}
          panelProps={monthPickerPanelTouch}
        >
          <div className="flex justify-center px-5 pb-1 pt-3 sm:hidden">
            <div className="h-1.5 w-10 rounded-full bg-gray-300" />
          </div>
          <div className="border-b border-gray-200 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">년월 선택</h3>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto p-5">
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">년도</div>
              <div className="h-48 overflow-y-auto rounded-lg border border-gray-200 p-1">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setDraftYear(year)}
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      draftYear === year
                        ? 'bg-blue-600 font-semibold text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {year}년
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-500">월</div>
              <div className="h-48 overflow-y-auto rounded-lg border border-gray-200 p-1">
                {months.map((month) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => setDraftMonth(month)}
                    className={`mb-1 w-full rounded-md px-3 py-2 text-sm ${
                      draftMonth === month
                        ? 'bg-blue-600 font-semibold text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {month}월
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                취소
              </button>
              <button
                type="button"
                onClick={applyMonthPicker}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                적용
              </button>
            </div>
          </div>
        </ModalShell>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-3 px-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: i % 2 + 2 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                      <div className="flex-1">
                        <div className="mb-1 h-5 w-32 animate-pulse rounded bg-gray-200" />
                        <div className="flex gap-2">
                          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                          <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
                        </div>
                      </div>
                      <div className="ml-4 h-5 w-20 animate-pulse rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
            <div className="text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm text-gray-500">기록을 불러오는데 실패했습니다.</p>
              <p className="mt-1 text-xs text-gray-400">{error}</p>
              <button
                onClick={() => void handleManualRefresh()}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
            <div className="text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm text-gray-500">이달의 기록이 없습니다.</p>
            </div>
          </div>
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
                    const isSaving = record._isSaving;
                    const hasMemo = Boolean(record.memo?.trim());
                    const displayMemo = !hasMemo && record.category === '식비'
                      ? '#식비'
                      : (record.memo || '-');
                    return (
                      <div
                        key={record.id}
                        onClick={() => !isSaving && handleRecordClick(record)}
                        className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all ${
                          isSaving ? 'cursor-default opacity-75' : 'cursor-pointer hover:shadow-md'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {isSaving && (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                            )}
                            <p className={`font-medium text-gray-900 ${isSaving ? 'text-gray-400' : ''}`}>
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
                          className={`ml-4 text-right font-bold ${record.amount > 0 ? 'text-emerald-600' : 'text-slate-700'}`}
                        >
                          {record.amount > 0 ? '+' : ''}
                          {Math.abs(record.amount).toLocaleString()}원
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <button
        onClick={() => void handleManualRefresh()}
        disabled={isRefreshing || loading}
        aria-label={isRefreshing ? '새로고침 중' : '새로고침'}
        className="safe-area-fab fixed right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRefreshing ? (
          <span
            className="block h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"
            aria-hidden="true"
          />
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )}
      </button>

      <DetailEntry
        isOpen={showDetailEntry}
        editRecord={editRecord}
        initialParsed={null}
        onClose={handleModalClose}
        onSubmit={() => undefined}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      <ChangeHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onRestore={(entry) => restoreHistory(entry, { onRestored: () => loadRecords(true) })}
      />
    </div>
  );
}

export default Archive;

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Record as TransactionRecord } from '../components/DetailEntry';
import { WEEKDAYS } from '../constants';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

// 현재 날짜의 YYYY-MM 가져오기
const getCurrentYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

// 월의 첫 날과 마지막 날 계산
const getMonthRange = (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: lastDay.toISOString().split('T')[0],
  };
};

function Archive() {
  const navigate = useNavigate();
  const [yearMonth, setYearMonth] = useState(() => getCurrentYearMonth());
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 월별 레코드 불러오기
  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const { startDate, endDate } = getMonthRange(yearMonth.year, yearMonth.month);
        const response = await api.getRecords({ startDate, endDate });
        if (response.data) {
          setRecords(response.data);
        }
      } catch (error: any) {
        console.error('Failed to load records:', error);
        setError(error.message || '기록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [yearMonth]);

  // 레코드를 일자별로 그룹화
  const groupedRecords = useMemo(() => {
    const groups: Record<string, TransactionRecord[]> = {};
    records.forEach((record) => {
      if (!groups[record.date]) {
        groups[record.date] = [];
      }
      groups[record.date].push(record);
    });
    // 날짜 내림차순 정렬 (최신 날짜 먼저)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [records]);

  // 이전 달로 이동
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

  // 다음 달로 이동
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

  // 현재 보고 있는 월의 총합 계산
  const monthlyTotal = useMemo(() => {
    return records.reduce((sum, record) => sum + record.amount, 0);
  }, [records]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur safe-area-top">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">월별 보기</h1>
            <button
              onClick={() => navigate('/')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              ← 홈
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 safe-area-header pb-6 sm:px-6">
        {/* Month Selector */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevMonth}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {yearMonth.year}년 {yearMonth.month}월
              </h2>
              <p className={`mt-1 text-sm font-medium ${monthlyTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {monthlyTotal >= 0 ? '+' : ''}{monthlyTotal.toLocaleString()}원
              </p>
            </div>
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

        {/* Records List */}
        {loading ? (
          <div className="space-y-6">
            {/* 스켈레톤: 3개 날짜 그룹 */}
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-3 px-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="space-y-2">
                  {/* 스켈레톤: 각 날짜별 2-3개 아이템 */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-gray-500">기록을 불러오는데 실패했습니다.</p>
              <p className="mt-1 text-xs text-gray-400">{error}</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
            <div className="text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-500">이달의 기록이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRecords.map(([date, dateRecords]) => (
              <div key={date}>
                <h4 className="mb-3 px-1 text-sm font-semibold text-gray-500">
                  {formatDate(date)}
                </h4>
                <div className="space-y-2">
                  {dateRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {record.memo || '-'}
                        </p>
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
                      <div className={`ml-4 text-right font-bold ${record.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {record.amount > 0 ? '+' : ''}{record.amount.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Archive;

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStats, transformCategoryData } from '../hooks/useStats';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceDot } from 'recharts';

type TabType = 'monthly' | 'yearly';

// 스켈레톤 컴포넌트
function ChartSkeleton({ height = "h-48" }: { height?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 ${height}`} />
  );
}

function StatsCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg bg-white p-3 shadow-sm">
      <div className="mb-1 h-6 w-16 bg-gray-200 mx-auto" />
      <div className="h-3 w-12 bg-gray-200 mx-auto" />
    </div>
  );
}

function toSafeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getProgressByDay(day: number, daysInMonth: number): number {
  if (daysInMonth <= 1) return 100;
  return ((day - 1) / (daysInMonth - 1)) * 100;
}

function getDayByProgress(progress: number, daysInMonth: number): number {
  if (daysInMonth <= 1) return 1;
  return Math.floor((progress / 100) * (daysInMonth - 1)) + 1;
}

function formatCompactKrw(value: number): string {
  if (value >= 10000) {
    const man = Math.round(value / 10000);
    return `${man.toLocaleString()}만원`;
  }
  return `${value.toLocaleString()}원`;
}

function enforceMonotonic(values: Array<number | null>): Array<number | null> {
  let last = 0;
  let hasValue = false;

  return values.map((value) => {
    if (value == null) return null;
    if (!hasValue) {
      last = value;
      hasValue = true;
      return value;
    }
    if (value < last) return last;
    last = value;
    return value;
  });
}

function getCumulativeAtProgress(
  daily: Array<{ amount: number }>,
  progress: number,
  daysInMonth: number,
  visibleDayLimit: number
): number | null {
  if (daysInMonth <= 0) return null;
  const mappedDay = Math.floor((progress / 100) * Math.max(daysInMonth - 1, 0)) + 1;
  if (mappedDay > visibleDayLimit) return null;

  const idx = Math.max(0, Math.min(mappedDay - 1, daily.length - 1));
  const current = daily[idx];
  if (current?.amount != null) {
    return Math.abs(toSafeNumber(current.amount));
  }

  // 중간 결측은 직전 누적값으로 유지한다.
  for (let i = idx - 1; i >= 0; i -= 1) {
    const prev = daily[i];
    if (prev?.amount != null) {
      return Math.abs(toSafeNumber(prev.amount));
    }
  }

  return 0;
}

function Stats() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [selectedYear, setSelectedYear] = useState(() => {
    const urlYear = Number(searchParams.get('year'));
    return Number.isInteger(urlYear) && urlYear >= 2000 && urlYear <= 9999 ? urlYear : defaultYear;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const urlMonth = Number(searchParams.get('month'));
    return Number.isInteger(urlMonth) && urlMonth >= 1 && urlMonth <= 12 ? urlMonth : defaultMonth;
  });
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(defaultYear);
  const [draftMonth, setDraftMonth] = useState(defaultMonth);

  const { data: stats, isPending, error } = useStats(selectedYear, selectedMonth);

  useEffect(() => {
    const currentYear = searchParams.get('year');
    const currentMonth = searchParams.get('month');
    const nextYear = String(selectedYear);
    const nextMonth = String(selectedMonth);

    if (currentYear === nextYear && currentMonth === nextMonth) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('year', nextYear);
    nextParams.set('month', nextMonth);
    setSearchParams(nextParams, { replace: true });
  }, [selectedYear, selectedMonth, searchParams, setSearchParams]);

  // 연도 목록 생성 (최근 5년)
  const currentYear = defaultYear;
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // 월 목록
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const minYear = years[years.length - 1];
  const maxYear = years[0];
  const isPrevDisabled = selectedYear === minYear && selectedMonth === 1;
  const isNextDisabled = selectedYear === maxYear && selectedMonth === 12;

  const moveMonth = (direction: -1 | 1) => {
    if (direction === -1 && isPrevDisabled) return;
    if (direction === 1 && isNextDisabled) return;

    if (direction === -1) {
      if (selectedMonth === 1) {
        setSelectedYear(selectedYear - 1);
        setSelectedMonth(12);
        return;
      }
      setSelectedMonth(selectedMonth - 1);
      return;
    }

    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
      return;
    }
    setSelectedMonth(selectedMonth + 1);
  };

  const openMonthPicker = () => {
    setDraftYear(selectedYear);
    setDraftMonth(selectedMonth);
    setIsMonthPickerOpen(true);
  };

  const applyMonthPicker = () => {
    setSelectedYear(draftYear);
    setSelectedMonth(draftMonth);
    setIsMonthPickerOpen(false);
  };
  const {
    panelRef: monthPickerRef,
    panelStyle: monthPickerStyle,
    panelTouch: monthPickerPanelTouch,
  } = usePullDownToClose({
    onClose: () => setIsMonthPickerOpen(false),
    enabled: isMonthPickerOpen,
  });

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

  // 선택한 기간에 따른 데이터 계산
  const safeCurrentMonth = {
    byCategory: stats?.currentMonth?.byCategory ?? {} as Record<string, number>,
  };
  const safeCurrentMonthDaily = stats?.currentMonthDaily ?? [];
  const safePreviousMonthDaily = stats?.previousMonthDaily ?? [];
  const currentCategoryData = transformCategoryData(safeCurrentMonth.byCategory);
  const yearSavings = toSafeNumber(stats?.yearSavings);
  const yearExpense = toSafeNumber(stats?.yearExpense);
  const yearSavingsRate = yearSavings + yearExpense > 0
    ? Math.round((yearSavings / (yearSavings + yearExpense)) * 100)
    : 0;

  // 일별 데이터를 차트용으로 변환 (일자 축이 아닌 월 진행률 축으로 정렬)
  const previousMonthDate = new Date(selectedYear, selectedMonth - 2, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth() + 1;
  const currentMonthDays = getDaysInMonth(selectedYear, selectedMonth);
  const previousMonthDays = getDaysInMonth(previousYear, previousMonth);
  const today = new Date();
  const isCurrentCalendarMonth =
    selectedYear === today.getFullYear() &&
    selectedMonth === today.getMonth() + 1;
  const currentVisibleDayLimit = isCurrentCalendarMonth
    ? Math.min(today.getDate(), currentMonthDays)
    : currentMonthDays;
  const referenceProgress = getProgressByDay(currentVisibleDayLimit, currentMonthDays);
  const referenceProgressPoint = Math.max(0, Math.min(100, Math.round(referenceProgress)));

  const rawComparisonData = stats
    ? Array.from({ length: 101 }, (_, progress) => ({
      progress,
      당월: getCumulativeAtProgress(
        safeCurrentMonthDaily,
        progress,
        currentMonthDays,
        currentVisibleDayLimit
      ),
      전월: getCumulativeAtProgress(
        safePreviousMonthDaily,
        progress,
        previousMonthDays,
        previousMonthDays
      ),
    }))
    : [];
  const monotonicCurrent = enforceMonotonic(rawComparisonData.map((item) => item.당월));
  const monotonicPrevious = enforceMonotonic(rawComparisonData.map((item) => item.전월));
  const dailyComparisonData = rawComparisonData.map((item, index) => ({
    progress: item.progress,
    당월: monotonicCurrent[index],
    전월: monotonicPrevious[index],
  }));
  const currentLineEnd = [...dailyComparisonData]
    .reverse()
    .find((item) => item.당월 != null);
  const currentComparedExpenseFromDaily = stats
    ? getCumulativeAtProgress(
      safeCurrentMonthDaily,
      referenceProgress,
      currentMonthDays,
      currentVisibleDayLimit
    ) ?? 0
    : 0;
  const previousComparedExpenseFromDaily = stats
    ? getCumulativeAtProgress(
      safePreviousMonthDaily,
      referenceProgress,
      previousMonthDays,
      previousMonthDays
    ) ?? 0
    : 0;
  const currentComparedExpense = currentComparedExpenseFromDaily;
  const previousComparedExpense = previousComparedExpenseFromDaily;
  const spendDiff = currentComparedExpense - previousComparedExpense;
  const spendDiffRate = previousComparedExpense > 0
    ? Math.round((spendDiff / previousComparedExpense) * 100)
    : 0;
  const comparisonAmounts = dailyComparisonData
    .flatMap((item) => [item.당월, item.전월])
    .filter((amount): amount is number => amount != null);
  const yMax = comparisonAmounts.length > 0 ? Math.max(...comparisonAmounts) : 0;
  const yPadding = yMax > 0 ? yMax * 0.08 : 1000;
  const yDomainMax = yMax + yPadding;
  const referencePointProgress = currentLineEnd?.progress ?? referenceProgressPoint;
  const referencePointAmount = currentLineEnd?.당월 ?? currentComparedExpenseFromDaily;
  const displayedExpense = currentLineEnd?.당월 ?? currentComparedExpenseFromDaily;
  const expenseFromCategory = Object.values(safeCurrentMonth.byCategory).reduce((sum, value) => {
    const amount = toSafeNumber(value);
    return sum + (amount > 0 ? amount : 0);
  }, 0);
  const expenseDisplayValue = displayedExpense > 0 ? displayedExpense : expenseFromCategory;
  const xTicks = Array.from(new Set([0, referenceProgressPoint, 100])).sort((a, b) => a - b);
  const headlineLabel = isCurrentCalendarMonth ? '오늘까지' : `${selectedMonth}월 말까지`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur safe-area-top">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">통계</h1>
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
      <main className="mx-auto max-w-2xl space-y-6 px-4 safe-area-header pb-6 sm:px-6">
        {/* 탭 메뉴 */}
        <div className="overflow-hidden rounded-xl">
          <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'monthly'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              월별
            </button>
            <button
              onClick={() => setActiveTab('yearly')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'yearly'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              연도별
            </button>
          </div>

          {/* 월별 탭 내용 */}
          {activeTab === 'monthly' && (
            <div className="pb-4 pt-4">
              <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  disabled={isPrevDisabled}
                  aria-label="이전달"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
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
                      {selectedYear}년 {selectedMonth}월
                    </h2>
                    <span className="mt-1 text-xs text-gray-500" aria-hidden="true">▼</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  disabled={isNextDisabled}
                  aria-label="다음달"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              </div>

              {isMonthPickerOpen && (
                <div
                  className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center"
                  onClick={() => setIsMonthPickerOpen(false)}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                    ref={monthPickerRef}
                    style={monthPickerStyle}
                    {...monthPickerPanelTouch}
                  >
                    <div className="flex justify-center px-5 pt-3 pb-1 sm:hidden">
                      <div className="h-1.5 w-10 rounded-full bg-gray-300" />
                    </div>
                    <div className="border-b border-gray-200 px-5 py-4">
                      <h3 className="text-base font-semibold text-gray-900">년월 선택</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-5">
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
                    <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setIsMonthPickerOpen(false)}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={applyMonthPicker}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        적용
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 에러 표시 */}
              {error && (
                <div className="mb-6 rounded-xl bg-red-50 p-4 text-center">
                  <p className="text-sm text-red-600">{error.message || '통계를 불러올 수 없습니다.'}</p>
                </div>
              )}

              {/* 월별 통계 내용 */}
              <div className="space-y-6">
                {/* 전월 대비 증감 */}
                <section className="overflow-hidden rounded-xl bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-[1.2rem] font-extrabold tracking-tight text-gray-900">
                      {headlineLabel} {formatCompactKrw(expenseDisplayValue)} 썼어요
                    </h3>
                    <p className="mt-1 text-[0.9rem] font-semibold tracking-tight text-gray-600">
                      지난달보다{' '}
                      <span className={spendDiff > 0 ? 'text-rose-500' : spendDiff < 0 ? 'text-blue-600' : 'text-gray-600'}>
                        {spendDiff === 0 ? '같은 수준' : `${formatCompactKrw(Math.abs(spendDiff))} ${spendDiff > 0 ? '더 쓰는 중' : '덜 쓰는 중'}`}
                      </span>
                    </p>
                  </div>
                  <div>
                    <div className="mb-5 h-48">
                      {isPending ? (
                        <ChartSkeleton />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <AreaChart data={dailyComparisonData}>
                            <defs>
                              <linearGradient id="previousSpendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#d2d7df" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#d2d7df" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="progress"
                              type="number"
                              domain={[0, 100]}
                              ticks={xTicks}
                              tickFormatter={(value: number) => `${selectedMonth}.${getDayByProgress(value, currentMonthDays)}`}
                              tick={{ fill: '#8a94a4', fontSize: 14 }}
                              tickLine={false}
                              axisLine={false}
                              dy={10}
                            />
                            <YAxis
                              tick={false}
                              tickLine={false}
                              axisLine={false}
                              width={0}
                              domain={[0, yDomainMax]}
                            />
                            <Area
                              type="monotone"
                              dataKey="전월"
                              stroke="none"
                              fill="url(#previousSpendFill)"
                              dot={false}
                              isAnimationActive={false}
                              legendType="none"
                            />
                            <Line
                              type="monotone"
                              dataKey="전월"
                              stroke="#c8ced8"
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              connectNulls={false}
                              animationDuration={250}
                            />
                            <Line
                              type="monotone"
                              dataKey="당월"
                              stroke="#e15764"
                              strokeWidth={3}
                              dot={false}
                              activeDot={false}
                              connectNulls={false}
                              animationDuration={250}
                            />
                            {currentComparedExpense != null && (
                              <ReferenceDot
                                x={referencePointProgress}
                                y={referencePointAmount}
                                r={0}
                                shape={(props: any) => {
                                  const cx = props?.cx ?? 0;
                                  const cy = props?.cy ?? 0;
                                  return (
                                    <g>
                                      <circle cx={cx} cy={cy} r={7} fill="#e15764">
                                        <animate
                                          attributeName="r"
                                          values="7;22"
                                          dur="1.6s"
                                          repeatCount="indefinite"
                                        />
                                        <animate
                                          attributeName="opacity"
                                          values="0.42;0"
                                          dur="1.6s"
                                          repeatCount="indefinite"
                                        />
                                      </circle>
                                      <circle cx={cx} cy={cy} r={4.5} fill="#e15764" />
                                    </g>
                                  );
                                }}
                              />
                            )}
                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              wrapperStyle={{ bottom: -8 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {isPending ? (
                        <>
                          <StatsCardSkeleton />
                          <StatsCardSkeleton />
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
                            <div className={`mb-1 text-xl font-bold ${spendDiffRate > 0 ? 'text-rose-500' : spendDiffRate < 0 ? 'text-blue-600' : 'text-gray-700'}`}>
                              {spendDiffRate > 0 ? '+' : ''}{spendDiffRate}%
                            </div>
                            <div className="text-xs text-gray-500">지출 증감</div>
                          </div>
                          <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
                            <div className="mb-1 text-xl font-bold text-gray-900">
                              {expenseDisplayValue.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">당월 지출</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* 카테고리별 지출 */}
                <section className="overflow-hidden rounded-xl bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">카테고리별 지출</h3>
                  </div>
                  <div className="p-5">
                    {isPending ? (
                      <ChartSkeleton height="h-44" />
                    ) : currentCategoryData.length > 0 ? (
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart
                            data={currentCategoryData}
                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                          >
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={55}
                              fontSize={11}
                              tick={{ fill: '#6b7280' }}
                            />
                            <Tooltip formatter={(value: any) => `${value.toLocaleString()}원`} />
                            <Bar
                              dataKey="value"
                              fill="#1a73e8"
                              radius={[4, 4, 0, 0]}
                              animationDuration={250}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-gray-500">데이터가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* 연도별 탭 내용 */}
          {activeTab === 'yearly' && (
            <div className="pb-4 pt-4">
              {/* 연도 선택 UI */}
              <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedYear((prev) => Math.max(minYear, prev - 1))}
                    disabled={selectedYear <= minYear}
                    aria-label="이전 연도"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="rounded-lg px-4 py-1.5 text-center">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedYear}년
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedYear((prev) => Math.min(maxYear, prev + 1))}
                    disabled={selectedYear >= maxYear}
                    aria-label="다음 연도"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 에러 표시 */}
              {error && (
                <div className="mb-6 rounded-xl bg-red-50 p-4 text-center">
                  <p className="text-sm text-red-600">{error.message || '통계를 불러올 수 없습니다.'}</p>
                </div>
              )}

              {/* 연도별 통계 내용 */}
              <div className="space-y-6">
                {/* 연간 저축률 */}
                <section className="overflow-hidden rounded-xl bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">연간 저축률</h3>
                  </div>
                  <div className="p-5">
                    {isPending ? (
                      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                        <ChartSkeleton height="h-44 w-full sm:h-48 sm:w-48" />
                        <div className="animate-pulse">
                          <div className="h-12 w-20 bg-gray-200" />
                          <div className="mt-1 h-4 w-12 bg-gray-200" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                        <div className="h-44 w-full sm:h-48 sm:w-48">
                          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: '저축', value: Math.max(0, yearSavings) },
                                  { name: '지출', value: yearExpense }
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={5}
                                dataKey="value"
                                animationDuration={250}
                              >
                                <Cell fill="#34a853" />
                                <Cell fill="#c5221f" />
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-center">
                          <div className={`text-4xl font-bold ${yearSavingsRate > 0 ? 'text-green-600' : 'text-red-600'} sm:text-5xl`}>
                            {yearSavingsRate}%
                          </div>
                          <div className="mt-1 text-sm text-gray-500">저축률</div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* 연간 요약 */}
                <section className="overflow-hidden rounded-xl bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">연간 요약</h3>
                  </div>
                  <div className="p-5">
                    {isPending ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="animate-pulse rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 h-10 w-24 bg-gray-200 mx-auto" />
                          <div className="h-4 w-12 bg-gray-200 mx-auto" />
                        </div>
                        <div className="animate-pulse rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 h-10 w-24 bg-gray-200 mx-auto" />
                          <div className="h-4 w-12 bg-gray-200 mx-auto" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 min-w-0 break-keep text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-green-600">
                            {yearSavings.toLocaleString()}원
                          </div>
                          <div className="text-sm text-gray-500">연간 저축</div>
                        </div>
                        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 min-w-0 break-keep text-[clamp(2rem,8vw,3rem)] font-bold leading-tight text-red-600">
                            {yearExpense.toLocaleString()}원
                          </div>
                          <div className="text-sm text-gray-500">연간 지출</div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Stats;

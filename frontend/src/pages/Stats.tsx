import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats, transformCategoryData, calculateMonthOverMonth } from '../hooks/useStats';
import { usePullDownToClose } from '../hooks/usePullDownToClose';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

function Stats() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(new Date().getFullYear());
  const [draftMonth, setDraftMonth] = useState(new Date().getMonth() + 1);

  const { data: stats, isPending, error } = useStats(selectedYear, selectedMonth);

  // 연도 목록 생성 (최근 5년)
  const currentYear = new Date().getFullYear();
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

  // 선택한 기간에 따른 데이터 계산
  const safeCurrentMonth = {
    expenseTotal: toSafeNumber(stats?.currentMonth?.expenseTotal),
    total: toSafeNumber(stats?.currentMonth?.total),
    byCategory: stats?.currentMonth?.byCategory ?? {} as Record<string, number>,
  };
  const safePreviousMonth = {
    expenseTotal: toSafeNumber(stats?.previousMonth?.expenseTotal),
    total: toSafeNumber(stats?.previousMonth?.total),
    byCategory: stats?.previousMonth?.byCategory ?? {} as Record<string, number>,
  };
  const safeCurrentMonthDaily = stats?.currentMonthDaily ?? [];
  const safePreviousMonthDaily = stats?.previousMonthDaily ?? [];
  const currentCategoryData = transformCategoryData(safeCurrentMonth.byCategory);
  const currentMonthExpenseTotal = toSafeNumber(safeCurrentMonth.expenseTotal);
  const previousMonthExpenseTotal = toSafeNumber(safePreviousMonth.expenseTotal);
  const momChange = stats
    ? calculateMonthOverMonth(currentMonthExpenseTotal, previousMonthExpenseTotal)
    : 0;
  const yearSavings = toSafeNumber(stats?.yearSavings);
  const yearExpense = toSafeNumber(stats?.yearExpense);
  const yearSavingsRate = yearSavings + yearExpense > 0
    ? Math.round((yearSavings / (yearSavings + yearExpense)) * 100)
    : 0;

  // 일별 데이터를 차트용으로 변환 (전월과 당월을 같은 일자에 매칭)
  const maxDays = Math.max(safeCurrentMonthDaily.length, safePreviousMonthDaily.length);
  const dailyComparisonData = stats ? Array.from({ length: maxDays }, (_, i) => ({
    day: i + 1,
    당월: safeCurrentMonthDaily[i]?.amount != null
      ? Math.abs(toSafeNumber(safeCurrentMonthDaily[i]?.amount))
      : null,
    전월: safePreviousMonthDaily[i]?.amount != null
      ? Math.abs(toSafeNumber(safePreviousMonthDaily[i]?.amount))
      : null,
  })) : [];

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
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex border-b border-gray-200">
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
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  disabled={isPrevDisabled}
                  aria-label="이전달"
                  className="h-9 w-9 rounded-full border border-gray-300 bg-white text-lg font-bold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={openMonthPicker}
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  {selectedYear}년 {selectedMonth}월
                  <span className="text-xs" aria-hidden="true">▼</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  disabled={isNextDisabled}
                  aria-label="다음달"
                  className="h-9 w-9 rounded-full border border-gray-300 bg-white text-lg font-bold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  →
                </button>
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
                <section className="overflow-hidden rounded-xl bg-gray-50">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">전월 대비 지출 증감 (일별 누적)</h3>
                  </div>
                  <div className="p-5">
                    <div className="mb-5 h-48">
                      {isPending ? (
                        <ChartSkeleton />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <LineChart data={dailyComparisonData}>
                            <XAxis
                              dataKey="day"
                              tick={false}
                              tickLine={false}
                              axisLine={false}
                              height={0}
                            />
                            <YAxis
                              tick={false}
                              tickLine={false}
                              axisLine={false}
                              width={0}
                            />
                            <Legend />
                            <Line
                              type="natural"
                              dataKey="당월"
                              stroke="#1a73e8"
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              connectNulls={false}
                              animationDuration={250}
                            />
                            <Line
                              type="natural"
                              dataKey="전월"
                              stroke="#9ca3af"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                              activeDot={false}
                              connectNulls={false}
                              animationDuration={250}
                            />
                          </LineChart>
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
                          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                            <div className={`mb-1 text-xl font-bold ${momChange > 0 ? 'text-green-600' : momChange < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                              {momChange > 0 ? '+' : ''}{momChange}%
                            </div>
                            <div className="text-xs text-gray-500">지출 증감</div>
                          </div>
                          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                            <div className="mb-1 text-xl font-bold text-gray-900">
                              {currentMonthExpenseTotal.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">당월 지출</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* 카테고리별 지출 */}
                <section className="overflow-hidden rounded-xl bg-gray-50">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">카테고리별 지출</h3>
                  </div>
                  <div className="p-5">
                    {isPending ? (
                      <ChartSkeleton height="h-44" />
                    ) : currentCategoryData.length > 0 ? (
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={currentCategoryData}>
                            <XAxis
                              dataKey="name"
                              angle={-45}
                              textAnchor="end"
                              height={55}
                              fontSize={11}
                              tick={{ fill: '#6b7280' }}
                            />
                            <YAxis tick={{ fill: '#6b7280' }} />
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
            <div className="p-6">
              {/* 연도 선택 UI */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-gray-700">연도</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
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
                <section className="overflow-hidden rounded-xl bg-gray-50">
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
                <section className="overflow-hidden rounded-xl bg-gray-50">
                  <div className="border-b border-gray-200 px-5 py-3">
                    <h3 className="text-base font-semibold text-gray-900">연간 요약</h3>
                  </div>
                  <div className="p-5">
                    {isPending ? (
                      <div className="grid grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 text-3xl font-bold text-green-600">
                            {yearSavings.toLocaleString()}원
                          </div>
                          <div className="text-sm text-gray-500">연간 저축</div>
                        </div>
                        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 text-3xl font-bold text-red-600">
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

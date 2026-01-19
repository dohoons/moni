import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStats, transformCategoryData, calculateMonthOverMonth } from '../hooks/useStats';
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

function Stats() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const { data: stats, isPending, error } = useStats(selectedYear, selectedMonth);

  // 연도 목록 생성 (최근 5년)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // 월 목록
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // 선택한 기간에 따른 데이터 계산
  const currentCategoryData = stats ? transformCategoryData(stats.currentMonth.byCategory) : [];
  const momChange = stats ? calculateMonthOverMonth(stats.currentMonth.total, stats.previousMonth.total) : 0;
  const yearSavingsRate = stats && stats.yearSavings + stats.yearExpense > 0
    ? Math.round((stats.yearSavings / (stats.yearSavings + stats.yearExpense)) * 100)
    : 0;

  // 일별 데이터를 차트용으로 변환 (전월과 당월을 같은 일자에 매칭)
  const maxDays = stats ? Math.max(stats.currentMonthDaily.length, stats.previousMonthDaily.length) : 0;
  const dailyComparisonData = stats ? Array.from({ length: maxDays }, (_, i) => ({
    day: i + 1,
    당월: stats.currentMonthDaily[i]?.amount ?? null,
    전월: stats.previousMonthDaily[i]?.amount ?? null,
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
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-24 pb-6 sm:px-6">
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
              {/* 년/월 선택 UI */}
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">년도</label>
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
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">월</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}월
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                    <h3 className="text-base font-semibold text-gray-900">전월 대비 증감 (일별 누적)</h3>
                  </div>
                  <div className="p-5">
                    <div className="mb-5 h-48">
                      {isPending ? (
                        <ChartSkeleton />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailyComparisonData}>
                            <XAxis
                              dataKey="day"
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <YAxis
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              axisLine={{ stroke: '#e5e7eb' }}
                            />
                            <Tooltip
                              formatter={(value: any) => value ? `${value.toLocaleString()}원` : '-'}
                              labelFormatter={(label) => `${label}일`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="당월"
                              stroke="#1a73e8"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="전월"
                              stroke="#9ca3af"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 3 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {isPending ? (
                        <>
                          <StatsCardSkeleton />
                          <StatsCardSkeleton />
                          <StatsCardSkeleton />
                        </>
                      ) : (
                        <>
                          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                            <div className={`mb-1 text-xl font-bold ${momChange > 0 ? 'text-green-600' : momChange < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                              {momChange > 0 ? '+' : ''}{momChange}%
                            </div>
                            <div className="text-xs text-gray-500">저축 증감</div>
                          </div>
                          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                            <div className="mb-1 text-xl font-bold text-gray-900">
                              {stats?.currentMonth.total.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">당월 합계</div>
                          </div>
                          <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                            <div className="mb-1 text-xl font-bold text-gray-900">
                              {stats?.yearSavings.toLocaleString()}원
                            </div>
                            <div className="text-xs text-gray-500">연간 저축</div>
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
                        <ResponsiveContainer width="100%" height="100%">
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
                            <Bar dataKey="value" fill="#1a73e8" radius={[4, 4, 0, 0]} />
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
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: '저축', value: Math.max(0, stats?.yearSavings ?? 0) },
                                  { name: '지출', value: stats?.yearExpense ?? 0 }
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={5}
                                dataKey="value"
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
                            {stats?.yearSavings.toLocaleString()}원
                          </div>
                          <div className="text-sm text-gray-500">연간 저축</div>
                        </div>
                        <div className="rounded-lg bg-white p-4 text-center shadow-sm">
                          <div className="mb-2 text-3xl font-bold text-red-600">
                            {stats?.yearExpense.toLocaleString()}원
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

/**
 * Stats Service
 *
 * 통계 계산
 */

/**
 * 일별 저축 계산 (누적)
 */
function getDailySavings(records, year, month) {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const monthRecords = records.filter(r => r.date.startsWith(monthPrefix));

  // 해당 월의 일수 계산
  const daysInMonth = new Date(year, month, 0).getDate();

  // 일별 저축 배열 초기화
  const dailySavings = [];

  // 각 일자별 저축액 계산
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const dayRecords = monthRecords.filter(r => r.date === dayStr);
    const dayTotal = dayRecords.reduce((sum, r) => sum + r.amount, 0);
    dailySavings.push({
      day: day,
      amount: dayTotal
    });
  }

  // 누적 합계 계산
  let cumulative = 0;
  return dailySavings.map(d => {
    cumulative += d.amount;
    return {
      day: d.day,
      amount: cumulative
    };
  });
}

/**
 * 월별 통계 계산
 */
function getMonthStats(records, year, month) {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const monthRecords = records.filter(r => r.date.startsWith(monthPrefix));

  const total = monthRecords.reduce((sum, r) => sum + r.amount, 0);

  const byCategory = {};

  monthRecords.forEach(r => {
    if (r.amount < 0) { // 지출만 집계
      const cat = r.category || '미분류';
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(r.amount);
    }
  });

  return {
    total: total,
    byCategory: byCategory
  };
}

/**
 * 전체 통계 조회
 *
 * @param {number} year - 조회할 연도
 * @param {number} month - 조회할 월
 */
function getAllStats(year, month) {
  const records = getAllRecordsForStats();

  // 저번달 계산
  let prevYear = year;
  let prevMonth = month - 1;

  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }

  const currentMonthStats = getMonthStats(records, year, month);
  const previousMonthStats = getMonthStats(records, prevYear, prevMonth);
  const currentMonthDaily = getDailySavings(records, year, month);
  const previousMonthDaily = getDailySavings(records, prevYear, prevMonth);

  // 연간 저축액 계산 (1월 ~ 선택한 달까지)
  let yearSavings = 0;
  let yearExpense = 0;

  for (let m = 1; m <= month; m++) {
    const stats = getMonthStats(records, year, m);
    yearSavings += stats.total;
    yearExpense += Object.values(stats.byCategory).reduce((sum, val) => sum + val, 0);
  }

  // 작년 동기 저축액
  const lastYearSavings = records
    .filter(r => r.date.startsWith(String(year - 1)))
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    currentMonth: currentMonthStats,
    previousMonth: previousMonthStats,
    currentMonthDaily: currentMonthDaily,
    previousMonthDaily: previousMonthDaily,
    yearSavings: yearSavings,
    yearExpense: yearExpense,
    lastYearSavings: lastYearSavings
  };
}

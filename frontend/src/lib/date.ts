const KST_TIME_ZONE = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const kstDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// 공개 API: 프로젝트 표준 날짜 문자열 반환 (KST, YYYY-MM-DD)
export function getTodayDate(): string {
  const parts = kstDateFormatter.formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    // Intl 파싱이 실패하면 KST(UTC+9, DST 없음) 기준으로 보정한다.
    const kstNow = new Date(Date.now() + KST_OFFSET_MS);
    return `${kstNow.getUTCFullYear()}-${pad2(kstNow.getUTCMonth() + 1)}-${pad2(kstNow.getUTCDate())}`;
  }

  return `${year}-${month}-${day}`;
}

// 공개 API: 월 시작/종료 날짜 문자열 반환 (KST 달력 기준, YYYY-MM-DD)
export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const monthText = pad2(month);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${monthText}-01`,
    endDate: `${year}-${monthText}-${pad2(lastDay)}`,
  };
}

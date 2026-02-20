import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { StatsData } from '../services/api';

type CategoryStats = Record<string, number>;
type MonthStats = StatsData['currentMonth'];

/**
 * 통계 Hook (React Query)
 *
 * - GET /api/stats 호출
 * - 5분간 캐시됨
 * - 자동 리프레시, 재시도, 로딩/에러 상태 관리
 */
export function useStats(year?: number, month?: number) {
  return useQuery({
    queryKey: ['stats', year, month],
    queryFn: async () => {
      const response = await api.getStats({ year, month });
      if (!response.data) {
        throw new Error('통계 데이터가 비어 있습니다.');
      }
      return response.data;
    },
  });
}

/**
 * 카테고리 데이터를 차트용으로 변환
 */
export function transformCategoryData(byCategory: CategoryStats): Array<{ name: string; value: number }> {
  return Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * 저축률 계산 (수입 / 지출)
 */
export function calculateSavingsRate(stats: MonthStats): number {
  const income = Math.max(0, stats.total); // 양수만 수입
  const expense = Object.values(stats.byCategory).reduce((sum, val) => sum + val, 0);

  if (income === 0) return 0;
  return Math.round((income / (income + expense)) * 100);
}

/**
 * 전월 대비 증감률 계산
 */
export function calculateMonthOverMonth(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

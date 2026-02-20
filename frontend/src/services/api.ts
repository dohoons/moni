import { forceRefreshAccessToken, getAccessToken } from './google-oauth';
import type { ParsedInput } from '../lib/parser';
import type { PaymentMethod } from '../constants';
import { getTodayDate } from '../lib/date';

const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL;

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseApiResponse(value: unknown): ApiResponse<unknown> | null {
  if (!isObjectRecord(value)) {
    return null;
  }

  const success = value.success;
  if (typeof success !== 'boolean') {
    return null;
  }

  const error = value.error;
  if (error !== undefined && typeof error !== 'string') {
    return null;
  }

  return {
    success,
    data: value.data,
    error,
  };
}

export interface ApiRecord {
  id: string;
  date: string;
  amount: number;
  memo: string;
  method: PaymentMethod | null;
  category: string | null;
  created: string;
  updated?: string;
}

interface StatsMonth {
  expenseTotal: number;
  total: number;
  byCategory: Record<string, number>;
}

export interface StatsData {
  currentMonth: StatsMonth;
  previousMonth: StatsMonth;
  currentMonthDaily: Array<{ day: number; amount: number }>;
  previousMonthDaily: Array<{ day: number; amount: number }>;
  yearSavings: number;
  yearExpense: number;
  lastYearSavings: number;
}

export interface Template {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number | null;
  memo: string | null;
  method: PaymentMethod | null;
  category: string | null;
  useCount: number;
  lastUsedAt: string | null;
  created: string;
  updated: string;
  sortOrder: number;
}

export interface TemplateDraft {
  name: string;
  type: 'income' | 'expense';
  amount: number | null;
  memo: string | null;
  method: PaymentMethod | null;
  category: string | null;
}

/**
 * GAS Web App은 CORS preflight를 처리하지 못하므로,
 * text/plain Content-Type으로 Simple Request를 만듭니다.
 *
 * Google OAuth Access Token을 포함하여 요청 전송
 */
async function request<T = unknown>(
  path: string,
  data?: unknown,
  allowAuthRetry = true,
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  // Google Access Token 획득
  const accessToken = await getAccessToken();

  // payload에 path, access_token, body 포함
  const payload: {
    path: string;
    access_token: string;
    body?: unknown;
  } = {
    path,
    access_token: accessToken,
  };
  if (data !== undefined) {
    payload.body = data;
  }

  const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    signal,
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  // HTML 응답인 경우 (에러 페이지 등)
  if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
    throw new Error('Invalid response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid response: ' + text.substring(0, 100));
  }

  const result = parseApiResponse(parsed);
  if (!result) {
    throw new Error('Invalid response shape');
  }

  // success: false인 경우 에러로 처리
  if (!result.success && result.error) {
    const isAuthError =
      result.error.includes('Token verification failed') ||
      result.error.includes('Unauthorized:') ||
      result.error.includes('Invalid access token format');

    // iOS Safari/PWA에서 저장된 토큰이 서버에서 무효 처리된 경우가 있어 1회 재발급 후 재시도
    if (allowAuthRetry && isAuthError) {
      const refreshed = await forceRefreshAccessToken();
      if (refreshed) {
        return request<T>(path, data, false, signal);
      }
    }

    throw new Error(result.error);
  }

  return {
    success: result.success,
    data: result.data as T,
    error: result.error,
  };
}

export const api = {
  createRecord: async (data: ParsedInput & { id?: string; date?: string }) => {
    // 지출이고 카테고리가 없으면 기본값 "식비" 설정
    const category = data.category || (data.amount < 0 ? '식비' : '');

    return request<{ id: string }>('/api/record', {
      ...data,
      category,
      date: data.date || getTodayDate(),
    });
  },

  updateRecord: async (id: string, data: Partial<ParsedInput> & { date?: string }) => {
    return request('/api/record/update', {
      id,
      ...data,
    });
  },

  deleteRecord: async (id: string) => {
    return request('/api/record/delete', { id });
  },

  getRecords: async (params?: { startDate?: string; endDate?: string; limit?: number; cursor?: string }) => {
    return request<ApiRecord[]>('/api/records', params || {});
  },

  searchRecords: async (params: { q: string; fields?: string[]; limit?: number; cursor?: string }) => {
    return request<ApiRecord[]>('/api/records/search', {
      q: params.q,
      fields: params.fields || ['memo'],
      limit: params.limit,
      cursor: params.cursor,
    });
  },

  getTemplates: async () => {
    return request<Template[]>('/api/templates');
  },

  createTemplate: async (data: TemplateDraft) => {
    return request<Template>('/api/template', data);
  },

  updateTemplate: async (id: string, data: Partial<TemplateDraft> & { name?: string }) => {
    return request<Template>('/api/template/update', { id, ...data });
  },

  deleteTemplate: async (id: string) => {
    return request<{ id: string }>('/api/template/delete', { id });
  },

  markTemplateUsed: async (id: string) => {
    return request<{ id: string; useCount: number; lastUsedAt: string; updated: string }>('/api/template/use', { id });
  },

  reorderTemplates: async (ids: string[], signal?: AbortSignal) => {
    return request<{ ids: string[] }>('/api/template/reorder', { ids }, true, signal);
  },

  getStats: async (params?: { year?: number; month?: number }) => {
    return request<StatsData>('/api/stats', params || {});
  },

  setup: async () => {
    return request('/api/setup');
  },
};

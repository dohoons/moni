import { forceRefreshAccessToken, getAccessToken } from './google-oauth';
import type { ParsedInput } from '../lib/parser';
import { getTodayDate } from '../lib/date';

const GAS_WEB_APP_URL = import.meta.env.VITE_GAS_WEB_APP_URL;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * GAS Web App은 CORS preflight를 처리하지 못하므로,
 * text/plain Content-Type으로 Simple Request를 만듭니다.
 *
 * Google OAuth Access Token을 포함하여 요청 전송
 */
async function request<T = any>(
  path: string,
  data?: any,
  allowAuthRetry = true
): Promise<ApiResponse<T>> {
  // Google Access Token 획득
  const accessToken = await getAccessToken();

  // payload에 path, access_token, body 포함
  const payload = {
    path,
    access_token: accessToken,
    ...(data && { body: data })
  };

  const response = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
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

  let result: ApiResponse<T>;
  try {
    result = JSON.parse(text) as ApiResponse<T>;
  } catch {
    throw new Error('Invalid response: ' + text.substring(0, 100));
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
        return request<T>(path, data, false);
      }
    }

    throw new Error(result.error);
  }

  return result;
}

export const api = {
  createRecord: async (data: ParsedInput & { id?: string; date?: string }) => {
    // 지출이고 카테고리가 없으면 기본값 "식비" 설정
    const category = data.category || (data.amount < 0 ? '식비' : '');

    return request('/api/record', {
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
    return request('/api/records', params || {});
  },

  getStats: async (params?: { year?: number; month?: number }) => {
    return request('/api/stats', params || {});
  },

  setup: async () => {
    return request('/api/setup');
  },
};

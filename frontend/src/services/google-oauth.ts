/**
 * Google OAuth Service
 *
 * Google Identity Services (GSI)를 사용한 OAuth 2.0 인증
 */

// Access Token 저장소
const TOKEN_STORAGE_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';

// 자동 갱신 설정
const REFRESH_THRESHOLD = 30 * 60 * 1000; // 30분 (밀리초)

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

let accessToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);
let tokenExpiry: number | null = TOKEN_EXPIRY_KEY in localStorage
  ? parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10)
  : null;

// Token Client 전역 변수 (자동 갱신용)
let tokenClient: any = null;
let isRefreshing = false;

/**
 * Google 로그인 핸들러
 *
 * GSI 라이브러리에서 호출되는 콜백 함수
 */
export async function handleGoogleSignIn(response: TokenResponse) {
  accessToken = response.access_token;
  tokenExpiry = Date.now() + (response.expires_in * 1000);

  // localStorage에 토큰 저장
  localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, tokenExpiry.toString());

  // 토큰 검증 로그 (디버깅용)
  console.log('[Google SignIn] Token received:', {
    length: response.access_token?.length,
    expiresIn: response.expires_in,
    scope: response.scope
  });

  // Google userinfo API로 사용자 정보 가져오기
  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${response.access_token}`
      }
    });

    console.log('[Google SignIn] UserInfo API status:', userInfoResponse.status);

    // tokeninfo API도 호출하여 토큰 검증 (GAS와 동일한 API)
    const tokeninfoResponse = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${response.access_token}`);
    console.log('[Google SignIn] TokenInfo API status:', tokeninfoResponse.status);
    if (tokeninfoResponse.ok) {
      const tokeninfo = await tokeninfoResponse.json();
      console.log('[Google SignIn] TokenInfo data:', {
        email: tokeninfo.email,
        aud: tokeninfo.aud,
        scope: tokeninfo.scope,
        exp: tokeninfo.exp
      });
    } else {
      console.error('[Google SignIn] TokenInfo error:', await tokeninfoResponse.text());
    }

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();

      // 사용자 정보 저장
      localStorage.setItem('user', JSON.stringify({
        email: userInfo.email,
        name: userInfo.given_name,
        picture: userInfo.picture
      }));

      return {
        email: userInfo.email,
        name: userInfo.given_name,
        picture: userInfo.picture
      };
    }
  } catch (err) {
    console.error('Failed to fetch user info:', err);
  }

  // 실패 시 null 반환
  return null;
}

/**
 * 자동 토큰 갱신 초기화
 *
 * - 앱 실행 시점에 토큰 상태 확인 및 갱신
 * - foreground 진입 시 30분 미만 남은 경우 silent 갱신
 */
export function initAutoRefresh() {
  if (window.google?.accounts?.oauth2 && !tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'email profile',
      callback: async (response: any) => {
        isRefreshing = false;

        if (response.access_token) {
          await handleGoogleSignIn(response);
          console.log('[AutoRefresh] Token refreshed successfully');
        } else {
          console.error('[AutoRefresh] Token refresh failed:', response);
          signOutGoogle();
          window.location.href = '/login';
        }
      },
      error_callback: (error: any) => {
        isRefreshing = false;
        console.error('[AutoRefresh] Token refresh error:', error);
        signOutGoogle();
        window.location.href = '/login';
      },
    });
  }

  // foreground 감지 이벤트 등록
  const events = ['visibilitychange', 'pageshow', 'focus'];
  events.forEach((event) => {
    window.addEventListener(event, handleForeground);
  });

  // 실행 시점 토큰 상태 확인
  if (accessToken && tokenExpiry) {
    const remainingTime = tokenExpiry - Date.now();
    if (remainingTime < REFRESH_THRESHOLD) {
      console.log(`[AutoRefresh] App start: Token expires in ${Math.floor(remainingTime / 60000)}min, refreshing...`);
      refreshAccessToken();
    } else {
      console.log(`[AutoRefresh] App start: Token valid for ${Math.floor(remainingTime / 60000)}min`);
    }
  }
}

/**
 * Foreground 진입 핸들러
 *
 * visibilitychange, pageshow, focus 이벤트에서 호출됩니다.
 */
function handleForeground(e: Event) {
  // pageshow 이벤트: 캐시에서 복구된 경우만 처리
  if (e.type === 'pageshow') {
    const pageEvent = e as PageTransitionEvent;
    if (!pageEvent.persisted) {
      return; // 캐시가 아니면 무시
    }
  }

  // foreground 확인
  if (document.hidden) {
    return; // 여전히 hidden이면 무시
  }

  // 이미 갱신 중이면 무시
  if (isRefreshing) {
    return;
  }

  // 토큰이 없으면 무시
  if (!accessToken || !tokenExpiry) {
    return;
  }

  // 토큰 유효시간 확인
  const remainingTime = tokenExpiry - Date.now();

  if (remainingTime < REFRESH_THRESHOLD) {
    console.log(`[AutoRefresh] Token expires in ${Math.floor(remainingTime / 60000)}min, refreshing...`);
    refreshAccessToken();
  }
}

/**
 * Access Token 갱신
 *
 * prompt: ''로 silent 갱신을 시도합니다.
 */
function refreshAccessToken() {
  if (!tokenClient) {
    console.warn('[AutoRefresh] TokenClient not initialized');
    return;
  }

  isRefreshing = true;

  // prompt: ''로 silent 갱신 (사용자 동의가 이미 있는 경우)
  tokenClient.requestAccessToken({ prompt: '' });
}

/**
 * 현재 Access Token 반환
 */
export async function getAccessToken(): Promise<string> {
  if (!accessToken || !tokenExpiry || Date.now() >= tokenExpiry) {
    throw new Error('Not authenticated or token expired');
  }

  return accessToken;
}

/**
 * 로그아웃
 *
 * 주의: 오프라인 대기열과 캐시도 초기화해야 보안상 안전함
 */
export function signOutGoogle() {
  const token = accessToken;
  accessToken = null;
  tokenExpiry = null;
  localStorage.removeItem('user');
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);

  // GSI로 로그아웃 요청
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    if (token) {
      window.google.accounts.oauth2.revoke(token);
    }
    window.google.accounts.id.disableAutoSelect();
  }
}

/**
 * 오프라인 대기열 초기화
 * (별도 export해서 signOutGoogle과 함께 호출하도록)
 */
export function clearOfflineData() {
  localStorage.removeItem('moni_pending_records');
  localStorage.removeItem('moni_last_sync');
}

/**
 * 현재 로그인된 사용자 정보 반환
 */
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    const user = JSON.parse(userStr);
    // email이 있는 경우에만 로그인으로 간주
    return user.email ? user : null;
  } catch {
    return null;
  }
}

/**
 * 타입 선언 (Google GSI)
 */
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => {
            requestAccessToken: () => void;
          };
          revoke: (token: string) => void;
        };
        id: {
          initialize: (config: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export {};

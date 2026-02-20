/**
 * Google OAuth Service
 *
 * Google Identity Services (GSI)를 사용한 OAuth 2.0 인증
 */

// Access Token 저장소
const TOKEN_STORAGE_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

// 자동 갱신 설정
const REFRESH_THRESHOLD = 30 * 60 * 1000; // 30분 (밀리초)

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

type TokenClientRequestConfig = {
  prompt?: '' | 'consent';
};

type TokenCallbackResponse = Partial<TokenResponse> & {
  error?: string;
};

type GoogleOAuthError = {
  type?: string;
  message?: string;
};

type TokenClient = {
  requestAccessToken: (config?: TokenClientRequestConfig) => void;
};

type TokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: TokenCallbackResponse) => void | Promise<void>;
  error_callback?: (error: GoogleOAuthError) => void;
};

type GoogleIdInitializeConfig = {
  client_id: string;
  callback?: () => void;
};

function isTokenResponse(response: TokenCallbackResponse): response is TokenResponse {
  return (
    typeof response.access_token === 'string'
    && typeof response.expires_in === 'number'
    && typeof response.scope === 'string'
    && typeof response.token_type === 'string'
  );
}

let accessToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);
let tokenExpiry: number | null = TOKEN_EXPIRY_KEY in localStorage
  ? parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10)
  : null;

// Token Client 전역 변수 (자동 갱신용)
let tokenClient: TokenClient | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let resolveRefresh: ((value: boolean) => void) | null = null;
let gsiLoadPromise: Promise<void> | null = null;
let isAutoRefreshInitialized = false;

function settleRefresh(result: boolean) {
  if (resolveRefresh) {
    resolveRefresh(result);
  }
  resolveRefresh = null;
  refreshPromise = null;
}

export async function ensureGoogleIdentityLoaded(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return;
  }

  if (gsiLoadPromise) {
    return gsiLoadPromise;
  }

  gsiLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement('script');

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };

    const onLoad = () => {
      if (window.google?.accounts?.oauth2) {
        cleanup();
        resolve();
      }
    };

    const onError = () => {
      cleanup();
      gsiLoadPromise = null;
      reject(new Error('Google 인증 스크립트를 불러오지 못했습니다.'));
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      gsiLoadPromise = null;
      reject(new Error('Google 인증 초기화가 지연되고 있습니다. 네트워크 상태를 확인해주세요.'));
    }, 10000);
    const intervalId = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        cleanup();
        resolve();
      }
    }, 100);

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    if (!existingScript) {
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.google?.accounts?.oauth2) {
      cleanup();
      resolve();
    }
  });

  return gsiLoadPromise;
}

function initTokenClient() {
  if (tokenClient || !window.google?.accounts?.oauth2) {
    return;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'email profile',
    callback: async (response) => {
      isRefreshing = false;
      try {
        if (isTokenResponse(response)) {
          await handleGoogleSignIn(response);
          console.log('[AutoRefresh] Token refreshed successfully');
          settleRefresh(true);
          return;
        }
        console.error('[AutoRefresh] Token refresh failed:', response);
        settleRefresh(false);
      } catch (error) {
        console.error('[AutoRefresh] Token refresh callback error:', error);
        settleRefresh(false);
      }
    },
    error_callback: (error) => {
      isRefreshing = false;
      console.error('[AutoRefresh] Token refresh error:', error);
      settleRefresh(false);
    },
  });
}

/**
 * Google 로그인 핸들러
 *
 * GSI 라이브러리에서 호출되는 콜백 함수
 */
export async function handleGoogleSignIn(response: TokenResponse): Promise<GoogleUser | null> {
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

export async function signInWithGoogle(): Promise<GoogleUser> {
  await ensureGoogleIdentityLoaded();

  return new Promise((resolve, reject) => {
    const interactiveClient = window.google?.accounts?.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'email profile',
      callback: async (response) => {
        try {
          if (!isTokenResponse(response)) {
            reject(new Error('로그인이 취소되었습니다.'));
            return;
          }

          const user = await handleGoogleSignIn(response);
          if (!user) {
            reject(new Error('사용자 정보를 불러오지 못했습니다.'));
            return;
          }

          resolve(user);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('로그인에 실패했습니다.'));
        }
      },
      error_callback: (error) => {
        console.error('[Google SignIn] initTokenClient error:', error);
        reject(new Error('Google 로그인 팝업을 열 수 없습니다.'));
      },
    });

    if (!interactiveClient) {
      reject(new Error('Google 로그인 초기화에 실패했습니다.'));
      return;
    }

    interactiveClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * 자동 토큰 갱신 초기화
 *
 * - 앱 실행 시점에 토큰 상태 확인 및 갱신
 * - foreground 진입 시 30분 미만 남은 경우 silent 갱신
 */
export async function initAutoRefresh() {
  try {
    await ensureGoogleIdentityLoaded();
    initTokenClient();
  } catch (error) {
    console.warn('[AutoRefresh] GSI script load skipped:', error);
    return;
  }

  // foreground 감지 이벤트 등록
  if (!isAutoRefreshInitialized) {
    const events = ['visibilitychange', 'pageshow', 'focus'];
    events.forEach((event) => {
      window.addEventListener(event, handleForeground);
    });
    isAutoRefreshInitialized = true;
  }

  // 실행 시점 토큰 상태 확인
  if (accessToken && tokenExpiry) {
    const remainingTime = tokenExpiry - Date.now();
    if (remainingTime < REFRESH_THRESHOLD) {
      console.log(`[AutoRefresh] App start: Token expires in ${Math.floor(remainingTime / 60000)}min, refreshing...`);
      const refreshed = await refreshAccessToken({ dispatchExpiredEvent: false });
      if (!refreshed) {
        window.dispatchEvent(new CustomEvent('moni-auth-expired'));
      }
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
    void refreshAccessToken();
  }
}

/**
 * Access Token 갱신
 *
 * prompt: ''로 silent 갱신을 시도합니다.
 */
async function refreshAccessToken(options: { dispatchExpiredEvent?: boolean } = {}): Promise<boolean> {
  const { dispatchExpiredEvent = true } = options;

  try {
    await ensureGoogleIdentityLoaded();
    initTokenClient();
  } catch (error) {
    console.warn('[AutoRefresh] Cannot refresh without GSI:', error);
    if (dispatchExpiredEvent) {
      window.dispatchEvent(new CustomEvent('moni-auth-expired'));
    }
    return false;
  }

  if (!tokenClient) {
    console.warn('[AutoRefresh] TokenClient not initialized');
    if (dispatchExpiredEvent) {
      window.dispatchEvent(new CustomEvent('moni-auth-expired'));
    }
    return false;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = new Promise((resolve) => {
    resolveRefresh = resolve;
  });

  // prompt: ''로 silent 갱신 (사용자 동의가 이미 있는 경우)
  tokenClient.requestAccessToken({ prompt: '' });

  const refreshed = await refreshPromise;
  if (!refreshed && dispatchExpiredEvent) {
    window.dispatchEvent(new CustomEvent('moni-auth-expired'));
  }
  return refreshed;
}

/**
 * 인증 실패 시 강제로 1회 silent 갱신 시도
 */
export async function forceRefreshAccessToken(): Promise<boolean> {
  return refreshAccessToken({ dispatchExpiredEvent: false });
}

/**
 * 현재 Access Token 반환
 */
export async function getAccessToken(): Promise<string> {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const refreshed = await refreshAccessToken({ dispatchExpiredEvent: false });
  if (!refreshed || !accessToken || !tokenExpiry || Date.now() >= tokenExpiry) {
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
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string) => void;
        };
        id: {
          initialize: (config: GoogleIdInitializeConfig) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export {};

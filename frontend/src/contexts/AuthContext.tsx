import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, signOutGoogle, clearOfflineData } from '../services/google-oauth';

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 통합 로그아웃 함수
  // - React Query 캐시 초기화
  // - 오프라인 대기열 초기화 (보안)
  // - Google 로그아웃
  // - 사용자 상태 초기화
  const logout = useCallback(() => {
    queryClient.clear();
    clearOfflineData();
    signOutGoogle();
    setUser(null);
  }, [queryClient]);

  // 인증 에러 핸들러 설정 (React Query v5: queryCache 'updated' 이벤트 감지)
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // 쿼리 상태가 업데이트될 때 에러 상태인지 확인
      if (event.type === 'updated' && event.query.state.status === 'error') {
        const error = event.query.state.error;
        if (error instanceof Error) {
          // 실제 사용 중인 인증 에러 메시지로 체크
          // - 클라이언트: 'Not authenticated or token expired' (google-oauth.ts)
          // - 서버: 'Unauthorized:', 'Invalid access token format', 'Token verification failed' (auth.js)
          if (
            error.message === 'Not authenticated or token expired' ||
            error.message.startsWith('Unauthorized:') ||
            error.message.startsWith('Invalid access token format') ||
            error.message.startsWith('Token verification failed') ||
            error.message.includes('Token verification failed')
          ) {
            logout();
            navigate('/login');
          }
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient, logout, navigate]);

  // 토큰 갱신 실패 이벤트 핸들러 (google-oauth.ts에서 발생)
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
      navigate('/login');
    };

    window.addEventListener('moni-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('moni-auth-expired', handleAuthExpired);
  }, [logout, navigate]);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

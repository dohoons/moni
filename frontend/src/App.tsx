import { useEffect, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initAutoRefresh } from './services/google-oauth';
import Login from './pages/Login';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Archive from './pages/Archive';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분
      retry: false, // 인증 에러 시 자동 재시도 방지
    },
  },
});

// 변하지 않는 로딩 UI (memo로 최적화)
const LoadingScreen = memo(function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-gray-600">로딩 중...</p>
      </div>
    </div>
  );
});

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
      <Route path="/stats" element={user ? <Stats /> : <Navigate to="/login" replace />} />
      <Route path="/archive" element={user ? <Archive /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  // 로그인된 사용자만 자동 갱신 초기화
  useEffect(() => {
    if (user) {
      initAutoRefresh();
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return <AppRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router basename="/moni">
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

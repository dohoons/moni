import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OverlayProvider } from 'overlay-kit';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initAutoRefresh } from './services/google-oauth';
import Login from './pages/Login';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Archive from './pages/Archive';
import Search from './pages/Search';
import MessageDialogProvider from './components/MessageDialogProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분
      retry: false, // 인증 에러 시 자동 재시도 방지
    },
  },
});

function AppContent() {
  const { user } = useAuth();

  // 로그인된 사용자만 자동 갱신 초기화
  useEffect(() => {
    if (user) {
      void initAutoRefresh();
    }
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
      <Route path="/search" element={user ? <Search /> : <Navigate to="/login" replace />} />
      <Route path="/stats" element={user ? <Stats /> : <Navigate to="/login" replace />} />
      <Route path="/archive" element={user ? <Archive /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OverlayProvider>
        <Router basename="/moni">
          <AuthProvider>
            <MessageDialogProvider />
            <AppContent />
          </AuthProvider>
        </Router>
      </OverlayProvider>
    </QueryClientProvider>
  );
}

export default App;

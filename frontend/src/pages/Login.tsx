import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../services/google-oauth';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await signInWithGoogle();
      setUser(user);
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Moni</h1>
          <p className="text-gray-600">나만의 간단한 가계부</p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="p-8">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-6 py-4 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:opacity-70 md:py-3"
            >
              <span className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209.838-.674 1.45-1.428 1.952v2.217h2.318c1.353-1.247 2.132-3.085 2.132-5.268 0-.537-.06-1.055-.17-1.542z" fill="#ffffff"/>
                  <path d="M9 16.5c1.3 0 2.5-.428 3.416-1.163l-1.415-1.096c-.49.33-1.116.527-1.845.527-1.383 0-2.527-1.116-2.658-2.48H5.317v-1.21h4.325c.13 1.364 1.275 2.48 2.658 2.48.73 0 1.356-.197 1.845-.527l1.415 1.096c-.916.735-2.116 1.163-3.416 1.163z" fill="#ffffff"/>
                  <path d="M5.317 9.25H3.137v1.21h2.18c-.13-1.364.275-2.48.658-2.48.73 0 1.356.197 1.845.527l-1.415 1.096c-.916.735-2.116 1.163-3.416 1.163z" fill="#ffffff"/>
                  <path d="M9 3.178c1.483 0 2.82.508 3.416 1.366l1.415-1.096C12.193 2.208 10.69 1.66 9 1.66c-2.067 0-3.864.705-5.183 1.818l2.318 1.79c.57-.76 1.58-1.29 2.865-1.29z" fill="#ffffff"/>
                </svg>
                {loading ? '로그인 중...' : 'Google로 계속하기'}
              </span>
            </button>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-center">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-8 py-4">
            <p className="text-center text-xs text-gray-500">
              가계부를 쉽고 빠르게 관리해보세요
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          클릭하여 로그인하면 이용약관에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}

export default Login;

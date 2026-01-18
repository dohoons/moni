import { useSync } from '../hooks/useSync';

interface SyncIndicatorProps {
  onRecordsUpdated?: () => void;
}

/**
 * 오프라인 동기화 상태 표시 컴포넌트
 *
 * - 온라인/오프라인 상태 표시
 * - 미동기화 레코드 수 표시
 * - 수동 동기화 버튼
 */
function SyncIndicator({ onRecordsUpdated }: SyncIndicatorProps) {
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();

  const handleSync = async () => {
    await syncNow();
    onRecordsUpdated?.();
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 sm:px-5 ${
        isOnline
          ? 'border-green-200 bg-green-50'
          : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <span
            className={`block h-3 w-3 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          {isOnline && (
            <span className="absolute inset-0 block h-3 w-3 animate-ping rounded-full bg-green-400 opacity-75" />
          )}
        </div>
        <div className="flex flex-col">
          <span
            className={`text-sm font-semibold ${
              isOnline ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {isOnline ? '온라인' : '오프라인'}
          </span>
          {pendingCount > 0 && (
            <span className="text-xs text-red-600">
              {pendingCount}개 미동기화
            </span>
          )}
        </div>
      </div>

      {pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={isSyncing || !isOnline}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-all ${
            isSyncing || !isOnline
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isSyncing ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              동기화 중
            </span>
          ) : (
            '지금 동기화'
          )}
        </button>
      )}
    </div>
  );
}

export default SyncIndicator;

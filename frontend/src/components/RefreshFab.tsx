interface RefreshFabProps {
  isRefreshing: boolean;
  isLoading?: boolean;
  onRefresh: () => void;
}

export default function RefreshFab({ isRefreshing, isLoading, onRefresh }: RefreshFabProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={isRefreshing || isLoading}
      aria-label={isRefreshing ? '새로고침 중' : '새로고침'}
      className="safe-area-fab fixed right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRefreshing ? (
        <span
          className="block h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )}
    </button>
  );
}

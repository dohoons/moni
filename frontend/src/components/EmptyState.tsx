interface EmptyStateProps {
  message: string;
  submessage?: string;
}

export default function EmptyState({ message, submessage }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
      <div className="text-center">
        <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-gray-500">{message}</p>
        {submessage && <p className="mt-1 text-xs text-gray-400">{submessage}</p>}
      </div>
    </div>
  );
}

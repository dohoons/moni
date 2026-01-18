import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { parseSmartEntry } from '../lib/parser';
import type { ParsedInput } from '../lib/parser';

interface SmartEntryProps {
  onSubmit: (parsed: ParsedInput) => void;
}

function SmartEntry({ onSubmit }: SmartEntryProps) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const isSubmittingRef = useRef(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    try {
      if (value.trim()) {
        const result = parseSmartEntry(value);
        setParsed(result);
      } else {
        setParsed(null);
      }
    } catch {
      setParsed(null);
    }
  };

  const handleSubmit = () => {
    if (parsed && !isSubmittingRef.current) {
      isSubmittingRef.current = true;
      onSubmit(parsed);
      setInput('');
      setParsed(null);
      // 다음 제출 가능하도록 약간의 지연 후 reset
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsed && !isSubmittingRef.current) {
      e.preventDefault(); // 폼 제출 방지
      handleSubmit();
    }
  };

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyPress}
          placeholder="5000 커피 신"
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-4 pr-12 text-base outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:py-3"
        />
        {input && (
          <button
            onClick={() => {
              setInput('');
              setParsed(null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {parsed && (
        <>
          <div
            className={`mt-3 rounded-xl p-4 ${
              parsed.amount > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  parsed.amount > 0
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-200 text-red-800'
                }`}
              >
                {parsed.amount > 0 ? '수입' : '지출'}
              </span>
              <span
                className={`text-xl font-bold sm:text-2xl ${
                  parsed.amount > 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {Math.abs(parsed.amount).toLocaleString()}원
              </span>
              {parsed.memo && (
                <span className="text-sm font-medium text-gray-700">{parsed.memo}</span>
              )}
            </div>

            {(parsed.method || parsed.category) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {parsed.method && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                    {parsed.method}
                  </span>
                )}
                {parsed.category && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    #{parsed.category}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            기록하기
          </button>
        </>
      )}

      {!parsed && input && (
        <div className="mt-2 text-xs text-gray-500">
          예: 5000 커피 신 (지출 5000원, 메모: 커피, 결제수단: 신용카드)
        </div>
      )}
    </div>
  );
}

export default SmartEntry;

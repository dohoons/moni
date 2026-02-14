import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { parseSmartEntry } from '../lib/parser';
import type { ParsedInput } from '../lib/parser';

interface SmartEntryProps {
  onSubmit: (parsed: ParsedInput) => void;
  onParsedChange?: (parsed: ParsedInput | null) => void;
  resetSignal?: number;
}

function SmartEntry({ onSubmit, onParsedChange, resetSignal = 0 }: SmartEntryProps) {
  const [isIncome, setIsIncome] = useState(false);
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const isSubmittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsIncome(false);
    setInput('');
    setParsed(null);
    onParsedChange?.(null);
  }, [resetSignal, onParsedChange]);

  const parseAndSync = (value: string, incomeMode: boolean = isIncome) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setParsed(null);
      onParsedChange?.(null);
      return;
    }

    const tokens = trimmed.split(/\s+/);
    const amountToken = tokens[0].replace(/,/g, '').replace(/^[+-]/, '');
    if (!/^\d+$/.test(amountToken)) {
      setParsed(null);
      onParsedChange?.(null);
      return;
    }

    const normalizedInput = `${incomeMode ? '+' : ''}${amountToken} ${tokens.slice(1).join(' ')}`.trim();

    try {
      const result = parseSmartEntry(normalizedInput);
      if (result.amount === 0) {
        setParsed(null);
        onParsedChange?.(null);
        return;
      }
      setParsed(result);
      onParsedChange?.(result);
    } catch {
      setParsed(null);
      onParsedChange?.(null);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInput(value);
    parseAndSync(value, isIncome);
  };

  const handleSubmit = () => {
    if (!parsed || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    onSubmit(parsed);
    setInput('');
    setParsed(null);
    onParsedChange?.(null);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 280);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && parsed && !isSubmittingRef.current) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const setIncomeMode = (incomeMode: boolean) => {
    setIsIncome(incomeMode);
    parseAndSync(input, incomeMode);
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const caret = node.value.length;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  return (
    <div>
      <div className="mb-3 flex h-14 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_20px_-18px_rgba(15,23,42,0.7)] transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
        <div className="m-1 flex w-16 shrink-0 flex-col rounded-lg bg-slate-50 p-0.5">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIncomeMode(false)}
            aria-pressed={!isIncome}
            className={`flex-1 rounded-md px-1 text-xs font-semibold leading-none transition-all ${
              !isIncome
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-700 active:bg-slate-100'
            }`}
          >
            지출
          </button>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIncomeMode(true)}
            aria-pressed={isIncome}
            className={`flex-1 rounded-md px-1 text-xs font-semibold leading-none transition-all ${
              isIncome
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-700 active:bg-slate-100'
            }`}
          >
            수입
          </button>
        </div>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="done"
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyPress}
            placeholder="5000 커피 신 식"
            className="h-full w-full bg-transparent px-4 pr-12 text-base outline-none placeholder:text-gray-400"
          />
          {input && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setInput('');
                setParsed(null);
                onParsedChange?.(null);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {parsed && (
        <>
          <div
            className={`mt-3 rounded-xl border p-4 ${
              parsed.amount > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  parsed.amount > 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
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
              {parsed.memo && <span className="text-sm font-medium text-gray-700">{parsed.memo}</span>}
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
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleSubmit}
            className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98]"
          >
            기록하기
          </button>
        </>
      )}

      {!parsed && input && (
        <div className="mt-2 text-xs text-gray-500">
          예: 5000 커피 신 식 (지출 5000원, 메모: 커피, 결제수단: 신용카드, 카테고리: 식비)
        </div>
      )}
    </div>
  );
}

export default SmartEntry;

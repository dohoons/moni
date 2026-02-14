import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { type ParsedInput } from '../lib/parser';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';
import { usePullDownToClose } from '../hooks/usePullDownToClose';

type PaymentMethod = '신용카드' | '체크카드' | '현금' | '계좌이체';

export interface Record {
  id: string;
  date: string;
  amount: number;
  memo: string;
  method: string | null;
  category: string | null;
  created: string;
}

interface DetailEntryProps {
  isOpen: boolean;
  editRecord: Record | null;
  initialParsed?: ParsedInput | null;
  onClose: () => void;
  onSubmit: (parsed: ParsedInput) => void;
  onUpdate: (id: string, parsed: Partial<ParsedInput>, date: string) => void;
  onDelete: (id: string) => void;
}

function DetailEntry({ isOpen, editRecord, initialParsed = null, onClose, onSubmit, onUpdate, onDelete }: DetailEntryProps) {
  const [isIncome, setIsIncome] = useState(false);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const { panelRef, panelStyle, panelTouch } = usePullDownToClose({ onClose, enabled: isOpen });

  const isEditMode = editRecord !== null;

  // 초기 데이터 설정 (편집 모드)
  useEffect(() => {
    if (editRecord) {
      setIsIncome(editRecord.amount > 0);
      setAmount(Math.abs(editRecord.amount).toString());
      setMemo(editRecord.memo || '');
      setMethod((editRecord.method as PaymentMethod) || '');
      setCategory(editRecord.category || '');
      setDate(editRecord.date);
    } else if (isOpen) {
      // 새 기록 모드 - 초기화
      setIsIncome((initialParsed?.amount ?? -1) > 0);
      setAmount(initialParsed?.amount ? Math.abs(initialParsed.amount).toString() : '');
      setMemo(initialParsed?.memo || '');
      setMethod((initialParsed?.method as PaymentMethod) || '');
      setCategory(initialParsed?.category || '');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [editRecord, isOpen, initialParsed]);

  // 수입/지출 전환 시 카테고리 리셋
  useEffect(() => {
    if (category) {
      const validCategories = isIncome ? (INCOME_CATEGORIES as readonly string[]) : (EXPENSE_CATEGORIES as readonly string[]);
      if (!(validCategories as readonly string[]).includes(category)) {
        setCategory('');
      }
    }
  }, [isIncome, category]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const numAmount = parseInt(amount) || 0;
    if (numAmount === 0) {
      alert('금액을 입력해주세요.');
      return;
    }

    const parsed: ParsedInput = {
      amount: isIncome ? numAmount : -numAmount,
      memo: memo.trim() || null,
      method: method || null,
      category: category.trim() || null,
    };

    if (isEditMode && editRecord) {
      onUpdate(editRecord.id, parsed, date);
    } else {
      onSubmit(parsed);
    }

    // Reset form (새 기록 모드일 때만)
    if (!isEditMode) {
      setIsIncome(false);
      setAmount('');
      setMemo('');
      setMethod('');
      setCategory('');
    }
  };

  const handleDelete = () => {
    if (isEditMode && editRecord) {
      if (confirm('정말 삭제하시겠습니까?')) {
        onDelete(editRecord.id);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        style={panelStyle}
        {...panelTouch}
      >
        <div className="flex justify-center px-6 pt-3 pb-1 sm:hidden">
          <div className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditMode ? '기록 수정' : '상세 기록'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {/* 날짜 (편집 모드에서만 표시) */}
          {isEditMode && (
            <div>
              <label htmlFor="date" className="mb-2 block text-sm font-medium text-gray-700">날짜 (YYYYMMDD)</label>
              <input
                id="date"
                type="text"
                inputMode="numeric"
                value={date.replace(/-/g, '')}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length > 8) val = val.slice(0, 8);

                  // YYYY-MM-DD 형식으로 변환하여 저장
                  let formatted = val;
                  if (val.length >= 5) {
                    formatted = val.slice(0, 4) + '-' + val.slice(4, 6) + (val.length > 6 ? '-' + val.slice(6) : '');
                  } else if (val.length >= 4) {
                    formatted = val.slice(0, 4) + '-' + val.slice(4);
                  }

                  setDate(formatted);
                }}
                placeholder="20250119"
                maxLength={8}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}

          {/* 수입/지출 토글 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">유형</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsIncome(false)}
                className={`flex-1 rounded-lg px-4 py-2.5 font-medium transition-all ${
                  !isIncome
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                지출
              </button>
              <button
                type="button"
                onClick={() => setIsIncome(true)}
                className={`flex-1 rounded-lg px-4 py-2.5 font-medium transition-all ${
                  isIncome
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                수입
              </button>
            </div>
          </div>

          {/* 금액 */}
          <div>
            <label htmlFor="amount" className="mb-2 block text-sm font-medium text-gray-700">
              금액 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 pr-12 text-lg outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">원</span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label htmlFor="memo" className="mb-2 block text-sm font-medium text-gray-700">메모</label>
            <input
              id="memo"
              type="text"
              value={memo}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMemo(e.target.value)}
              placeholder="예: 점심, 커피, 교통비..."
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 결제수단 */}
          <div>
            <label htmlFor="method" className="mb-2 block text-sm font-medium text-gray-700">결제수단</label>
            <select
              id="method"
              value={method}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setMethod(e.target.value as PaymentMethod | '')
              }
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">선택 안함</option>
              <option value="신용카드">신용카드</option>
              <option value="체크카드">체크카드</option>
              <option value="현금">현금</option>
              <option value="계좌이체">계좌이체</option>
            </select>
          </div>

          {/* 카테고리 */}
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-700">카테고리</label>
            <select
              id="category"
              value={category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">선택 안함</option>
              {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 gap-3 border-t border-gray-200 px-6 py-4">
          {isEditMode && (
            <button
              onClick={handleDelete}
              className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 font-medium text-red-700 transition-all hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              삭제
            </button>
          )}
          <div className="flex flex-1 gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isEditMode ? '수정' : '기록하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailEntry;

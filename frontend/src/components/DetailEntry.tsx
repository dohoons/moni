import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { type ParsedInput } from '../lib/parser';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type PaymentMethod } from '../constants';
import { useDialogViewport } from '../hooks/useDialogViewport';
import { showAlert, showConfirm } from '../services/message-dialog';
import type { Template } from '../services/api';
import ModalShell from './ModalShell';
import DialogSelect from './DialogSelect';
import { getTodayDate } from '../lib/date';

export interface Record {
  id: string;
  date: string;
  amount: number;
  memo: string;
  method: PaymentMethod | null;
  category: string | null;
  created: string;
}

interface DetailEntryProps {
  isOpen: boolean;
  editRecord: Record | null;
  initialParsed?: ParsedInput | null;
  initialTemplate?: Template | null;
  onClose: () => void;
  onAfterClose?: () => void;
  onSubmit: (parsed: ParsedInput) => void;
  onUpdate: (id: string, parsed: Partial<ParsedInput>, date: string) => void;
  onDelete: (id: string) => void;
  openTemplateSaveModal?: (input: {
    type: 'income' | 'expense';
    amount: number | null;
    memo: string | null;
    method: PaymentMethod | null;
    category: string | null;
  }) => Promise<void>;
  showTemplateSaveButton?: boolean;
}

interface DetailFormState {
  isIncome: boolean;
  amount: string;
  memo: string;
  method: PaymentMethod | '';
  category: string;
  date: string;
}

type DetailEntryInnerProps = Omit<DetailEntryProps, 'initialParsed' | 'initialTemplate'> & {
  initialFormState: DetailFormState;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: '신용카드', label: '신용카드' },
  { value: '체크카드', label: '체크카드' },
  { value: '현금', label: '현금' },
  { value: '계좌이체', label: '계좌이체' },
] as const;

function buildInitialFormState({
  editRecord,
  initialParsed,
  initialTemplate,
}: {
  editRecord: Record | null;
  initialParsed: ParsedInput | null;
  initialTemplate: Template | null;
}): DetailFormState {
  if (editRecord) {
    return {
      isIncome: editRecord.amount > 0,
      amount: Math.abs(editRecord.amount).toString(),
      memo: editRecord.memo || '',
      method: editRecord.method || '',
      category: editRecord.category || '',
      date: editRecord.date,
    };
  }

  if (initialTemplate) {
    return {
      isIncome: initialTemplate.type === 'income',
      amount: initialTemplate.amount !== null ? Math.abs(initialTemplate.amount).toString() : '',
      memo: initialTemplate.memo || '',
      method: initialTemplate.method || '',
      category: initialTemplate.category || '',
      date: getTodayDate(),
    };
  }

  return {
    isIncome: (initialParsed?.amount ?? -1) > 0,
    amount: initialParsed?.amount ? Math.abs(initialParsed.amount).toString() : '',
    memo: initialParsed?.memo || '',
    method: initialParsed?.method || '',
    category: initialParsed?.category || '',
    date: getTodayDate(),
  };
}

function DetailEntryInner({
  isOpen,
  editRecord,
  onClose,
  onAfterClose,
  onSubmit,
  onUpdate,
  onDelete,
  openTemplateSaveModal,
  showTemplateSaveButton = true,
  initialFormState,
}: DetailEntryInnerProps) {
  const [isIncome, setIsIncome] = useState(initialFormState.isIncome);
  const [amount, setAmount] = useState(initialFormState.amount);
  const [memo, setMemo] = useState(initialFormState.memo);
  const [method, setMethod] = useState<PaymentMethod | ''>(initialFormState.method);
  const [category, setCategory] = useState(initialFormState.category);
  const [date, setDate] = useState(initialFormState.date);
  const { isMobile } = useDialogViewport(isOpen);

  const isEditMode = editRecord !== null;

  const handleTypeChange = (nextIsIncome: boolean) => {
    setIsIncome(nextIsIncome);

    if (!category) return;

    const validCategories = nextIsIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!(validCategories as readonly string[]).includes(category)) {
      setCategory('');
    }
  };

  useEffect(() => {
    if (!isOpen || !isMobile) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        window.setTimeout(() => {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 140);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
    };
  }, [isOpen, isMobile]);

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSubmit();
  };

  const numAmount = parseInt(amount) || 0;
  const parsedAmount = isIncome ? numAmount : -numAmount;
  const parsedMemo = memo.trim() || null;
  const parsedMethod = method || null;
  const parsedCategory = category.trim() || null;

  const isUnchangedInEditMode =
    isEditMode &&
    !!editRecord &&
    parsedAmount === editRecord.amount &&
    parsedMemo === (editRecord.memo || null) &&
    parsedMethod === (editRecord.method || null) &&
    parsedCategory === (editRecord.category || null) &&
    date === editRecord.date;

  const handleSubmit = async () => {
    if (numAmount === 0) {
      await showAlert('금액을 입력해주세요.');
      return;
    }

    if (isUnchangedInEditMode) {
      return;
    }

    const parsed: ParsedInput = {
      amount: parsedAmount,
      memo: parsedMemo,
      method: parsedMethod,
      category: parsedCategory,
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

  const handleDelete = async () => {
    if (isEditMode && editRecord) {
      if (
        await showConfirm('정말 삭제하시겠습니까?', {
          primaryLabel: '삭제',
          secondaryLabel: '취소',
          tone: 'danger',
        })
      ) {
        onDelete(editRecord.id);
      }
    }
  };

  const requestTemplateSave = async () => {
    if (!openTemplateSaveModal) return;
    await openTemplateSaveModal({
      type: isIncome ? 'income' : 'expense',
      amount: numAmount > 0 ? parsedAmount : null,
      memo: memo.trim() || null,
      method: method || null,
      category: category.trim() || null,
    });
  };

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      variant="sheet"
      adjustForViewport
      pullToClose
    >
        <ModalShell.SheetHandle />
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditMode ? '기록 수정' : '상세 기록'}
          </h3>
          <div className="flex items-center gap-2">
            {showTemplateSaveButton && (
              <button
                type="button"
                onClick={() => void requestTemplateSave()}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                템플릿 저장
              </button>
            )}
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                삭제
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
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
                onClick={() => handleTypeChange(false)}
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
                onClick={() => handleTypeChange(true)}
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
            <DialogSelect
              id="method"
              label="결제수단"
              value={method}
              options={PAYMENT_METHOD_OPTIONS}
              onChange={(selected) => setMethod(selected)}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label htmlFor="category" className="mb-2 block text-sm font-medium text-gray-700">카테고리</label>
            <DialogSelect
              id="category"
              label="카테고리"
              value={category}
              options={(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => ({ value: cat, label: cat }))}
              onChange={(selected) => setCategory(selected)}
            />
          </div>
          </div>

          {/* Footer */}
          <ModalShell.Footer className="flex flex-shrink-0 gap-3">
            <div className="flex flex-1 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isUnchangedInEditMode}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300"
              >
                {isEditMode ? '수정' : '기록하기'}
              </button>
            </div>
          </ModalShell.Footer>
        </form>
    </ModalShell>
  );
}

function DetailEntry({
  isOpen,
  editRecord,
  initialParsed = null,
  initialTemplate = null,
  onClose,
  onAfterClose,
  onSubmit,
  onUpdate,
  onDelete,
  openTemplateSaveModal,
  showTemplateSaveButton = true,
}: DetailEntryProps) {
  const initialFormState = buildInitialFormState({
    editRecord,
    initialParsed,
    initialTemplate,
  });

  const sourceKey = editRecord
    ? `edit:${editRecord.id}`
    : initialTemplate
      ? `template:${initialTemplate.id}`
      : initialParsed
        ? 'parsed'
        : 'empty';
  const formKey = `${isOpen ? 'open' : 'closed'}|${sourceKey}`;

  return (
    <DetailEntryInner
      key={formKey}
      isOpen={isOpen}
      editRecord={editRecord}
      onClose={onClose}
      onAfterClose={onAfterClose}
      onSubmit={onSubmit}
      onUpdate={onUpdate}
      onDelete={onDelete}
      openTemplateSaveModal={openTemplateSaveModal}
      showTemplateSaveButton={showTemplateSaveButton}
      initialFormState={initialFormState}
    />
  );
}

export default DetailEntry;

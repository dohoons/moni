/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { overlay } from 'overlay-kit';
import type { PaymentMethod } from '../constants';
import { api } from '../services/api';
import { showAlert } from '../services/message-dialog';
import ModalShell from './ModalShell';

interface TemplateSaveModalProps {
  isOpen: boolean;
  input: TemplateSaveInput;
  onClose: () => void;
  onAfterClose?: () => void;
}

type TemplateSaveInput = {
  type: 'income' | 'expense';
  amount: number | null;
  memo: string | null;
  method: PaymentMethod | null;
  category: string | null;
};

export function useTemplateSave() {
  const openTemplateSaveModal = useCallback(
    (input: TemplateSaveInput) =>
      overlay.openAsync<void>(({ isOpen, close, unmount }) => (
        <TemplateSaveModal
          isOpen={isOpen}
          input={input}
          onClose={() => close(undefined)}
          onAfterClose={unmount}
        />
      )),
    []
  );

  return { openTemplateSaveModal };
}

function TemplateSaveModal({ isOpen, input, onClose, onAfterClose }: TemplateSaveModalProps) {
  const queryClient = useQueryClient();
  const hasAmount = input.amount !== null;
  const [name, setName] = useState('');
  const [includeAmount, setIncludeAmount] = useState(hasAmount);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setIncludeAmount(hasAmount);
    setIsSubmitting(false);
  }, [isOpen, hasAmount]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const finalAmount = includeAmount && hasAmount ? input.amount : null;
      if (!finalAmount && !input.memo && !input.method && !input.category) {
        await showAlert('템플릿에 저장할 값을 1개 이상 입력해주세요.');
        return;
      }

      await api.createTemplate({
        name: name.trim(),
        type: input.type,
        amount: finalAmount,
        memo: input.memo,
        method: input.method,
        category: input.category,
      });
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      await showAlert('템플릿으로 저장했습니다.');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      panelClassName="w-full max-w-none rounded-t-2xl bg-white shadow-xl sm:max-w-sm sm:rounded-2xl"
      adjustForViewport
    >
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">템플릿 저장</h3>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div>
          <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-gray-700">
            템플릿 이름
          </label>
          <input
            id="template-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 점심카드"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <label className={`flex items-center gap-2 text-sm ${hasAmount ? 'text-gray-700' : 'text-gray-400'}`}>
          <input
            type="checkbox"
            checked={hasAmount ? includeAmount : false}
            disabled={!hasAmount}
            onChange={(event) => setIncludeAmount(event.target.checked)}
          />
          금액 포함해서 저장
        </label>
      </div>
      <ModalShell.Footer className="flex gap-3 border-gray-200 px-5">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="button"
          disabled={!name.trim() || isSubmitting}
          onClick={() => void handleSubmit()}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          저장
        </button>
      </ModalShell.Footer>
    </ModalShell>
  );
}

export default TemplateSaveModal;

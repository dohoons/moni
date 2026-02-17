import { useEffect, useMemo, useRef, useState } from 'react';
import type { Template } from '../services/api';
import ModalShell from './ModalShell';

interface TemplatePickerModalProps {
  isOpen: boolean;
  templates: Template[];
  isLoading: boolean;
  isSavingOrder: boolean;
  deletingTemplateId?: string | null;
  errorMessage?: string;
  onClose: () => void;
  onSelect: (template: Template) => void;
  onReorder: (ids: string[]) => void;
  onDelete: (template: Template) => void;
}

function TemplatePickerModal({
  isOpen,
  templates,
  isLoading,
  isSavingOrder,
  deletingTemplateId = null,
  errorMessage,
  onClose,
  onSelect,
  onReorder,
  onDelete,
}: TemplatePickerModalProps) {
  const [orderedTemplates, setOrderedTemplates] = useState<Template[]>(templates);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [skipClickId, setSkipClickId] = useState<string | null>(null);
  const orderedTemplatesRef = useRef<Template[]>(templates);
  const dragPointerIdRef = useRef<number | null>(null);
  const didMoveRef = useRef(false);

  useEffect(() => {
    setOrderedTemplates(templates);
  }, [templates]);

  useEffect(() => {
    orderedTemplatesRef.current = orderedTemplates;
  }, [orderedTemplates]);

  const filtered = useMemo(() => orderedTemplates, [orderedTemplates]);
  const canDrag = !isLoading && !errorMessage;

  const getSubtitle = (template: Template) => {
    const parts = [template.memo, template.method, template.category].filter(Boolean);
    if (parts.length === 0) return '입력값 없음';
    return parts.join(' · ');
  };

  const getAmountLabel = (template: Template) => {
    if (template.amount === null) return '금액 없음';
    return `${Math.abs(template.amount).toLocaleString()}원`;
  };

  const moveTemplate = (sourceId: string, targetId: string, shouldPersist: boolean = true) => {
    if (sourceId === targetId) return;

    const sourceIndex = orderedTemplates.findIndex((item) => item.id === sourceId);
    const targetIndex = orderedTemplates.findIndex((item) => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const next = [...orderedTemplates];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setOrderedTemplates(next);

    if (!shouldPersist) return;
    onReorder(next.map((item) => item.id));
  };

  const handleTemplateClick = (template: Template) => {
    if (skipClickId === template.id) {
      setSkipClickId(null);
      return;
    }
    onSelect(template);
  };

  return (
    <ModalShell
      open={isOpen}
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      panelClassName="flex w-full max-w-none max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
    >
      <div className="border-b border-gray-200 px-5 py-4">
        <h3 className="text-base font-semibold text-gray-900">템플릿 선택</h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isLoading && <p className="px-2 py-3 text-sm text-gray-500">불러오는 중...</p>}
        {!isLoading && errorMessage && <p className="px-2 py-3 text-sm text-red-600">{errorMessage}</p>}
        {!isLoading && !errorMessage && filtered.length === 0 && (
          <p className="px-2 py-3 text-sm text-gray-500">템플릿이 없습니다.</p>
        )}
        {!isLoading &&
          !errorMessage &&
          filtered.map((template) => (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => handleTemplateClick(template)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleTemplateClick(template);
                }
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
              data-template-id={template.id}
            >
              <span
                role="button"
                aria-label={canDrag ? '드래그 핸들' : '드래그 핸들(저장 중)'}
                onPointerDown={(event) => {
                  if (!canDrag) return;
                  dragPointerIdRef.current = event.pointerId;
                  didMoveRef.current = false;
                  setDraggingId(template.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerMove={(event) => {
                  if (!canDrag) return;
                  if (dragPointerIdRef.current !== event.pointerId) return;
                  if (!draggingId) return;
                  const hovered = document.elementFromPoint(event.clientX, event.clientY);
                  const targetNode = hovered?.closest('[data-template-id]');
                  const targetId = targetNode?.getAttribute('data-template-id');
                  if (!targetId || targetId === draggingId) return;
                  didMoveRef.current = true;
                  moveTemplate(draggingId, targetId, false);
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  if (dragPointerIdRef.current !== event.pointerId) return;
                  const moved = didMoveRef.current;
                  dragPointerIdRef.current = null;
                  didMoveRef.current = false;
                  setDraggingId(null);
                  if (moved) {
                    const ids = orderedTemplatesRef.current.map((item) => item.id);
                    setSkipClickId(template.id);
                    onReorder(ids);
                  }
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerCancel={() => {
                  dragPointerIdRef.current = null;
                  didMoveRef.current = false;
                  setDraggingId(null);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className={`touch-none flex h-10 w-6 shrink-0 items-center justify-center self-stretch select-none rounded-md border text-sm leading-none ${
                  draggingId === template.id
                    ? 'cursor-grabbing border-blue-300 bg-blue-50 text-blue-700'
                    : canDrag
                      ? 'cursor-grab border-gray-200 bg-gray-50 text-gray-500'
                      : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                }`}
              >
                {isSavingOrder ? (
                  <span
                    aria-hidden="true"
                    className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
                  />
                ) : (
                  <svg aria-hidden="true" className="h-4 w-2" viewBox="0 0 8 16" fill="currentColor">
                    <circle cx="4" cy="3" r="1" />
                    <circle cx="4" cy="8" r="1" />
                    <circle cx="4" cy="13" r="1" />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{template.name}</p>
                <p className="truncate text-xs text-gray-500">{getSubtitle(template)}</p>
              </div>
              <div className="min-w-[64px] text-right">
                <p className="text-xs font-medium text-gray-700">{getAmountLabel(template)}</p>
                <p className="text-[11px] text-gray-400">{template.type === 'income' ? '수입' : '지출'}</p>
              </div>
              <button
                type="button"
                aria-label="템플릿 삭제"
                disabled={deletingTemplateId === template.id}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(template);
                }}
                className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingTemplateId === template.id ? (
                  <span
                    aria-hidden="true"
                    className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent"
                  />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12m-9 0V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a2 2 0 002 2h4a2 2 0 002-2V7" />
                  </svg>
                )}
              </button>
            </div>
          ))}
      </div>

      <div className="border-t border-gray-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          닫기
        </button>
      </div>
    </ModalShell>
  );
}

export default TemplatePickerModal;

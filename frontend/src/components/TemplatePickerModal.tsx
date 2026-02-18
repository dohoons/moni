/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { overlay } from 'overlay-kit';
import { api, type Template } from '../services/api';
import { showAlert, showConfirm } from '../services/message-dialog';
import ModalShell from './ModalShell';

const EMPTY_TEMPLATES: Template[] = [];

interface TemplatePickerModalProps {
  isOpen: boolean;
  onAfterClose?: () => void;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

interface SortableTemplateRowProps {
  template: Template;
  canDrag: boolean;
  savingOrder: boolean;
  activeDeletingId: string | null;
  onTemplateClick: (template: Template) => void;
  onDelete: (template: Template) => void;
  getSubtitle: (template: Template) => string;
  getAmountLabel: (template: Template) => string;
}

async function fetchTemplates() {
  const response = await api.getTemplates();
  return response.data || [];
}

function orderTemplates(templates: Template[], orderedTemplateIds: string[] | null) {
  if (!orderedTemplateIds) return templates;
  const byId = new Map(templates.map((item) => [item.id, item]));
  const ordered = orderedTemplateIds
    .map((id) => byId.get(id))
    .filter(Boolean) as Template[];
  const orderedIdSet = new Set(orderedTemplateIds);
  const remaining = templates.filter((item) => !orderedIdSet.has(item.id));
  return [...ordered, ...remaining];
}

function buildReorderPayload(ids: string[], templates: Template[]) {
  const templateIds = templates.map((template) => template.id);
  const available = new Set(templateIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  ids.forEach((id) => {
    if (!available.has(id) || seen.has(id)) return;
    ordered.push(id);
    seen.add(id);
  });

  templateIds.forEach((id) => {
    if (seen.has(id)) return;
    ordered.push(id);
    seen.add(id);
  });

  return ordered;
}

function reorderTemplatesInCache(templates: Template[], ids: string[]) {
  const byId = new Map(templates.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as Template[];
  const orderedSet = new Set(ordered.map((item) => item.id));
  const remaining = templates.filter((item) => !orderedSet.has(item.id));

  return [...ordered, ...remaining].map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

function areSameOrder(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function SortableTemplateRow({
  template,
  canDrag,
  savingOrder,
  activeDeletingId,
  onTemplateClick,
  onDelete,
  getSubtitle,
  getAmountLabel,
}: SortableTemplateRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onTemplateClick(template)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTemplateClick(template);
        }
      }}
      className={`mt-1 flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition-colors ${
        isDragging ? 'bg-blue-50/70' : 'hover:bg-gray-50'
      }`}
      data-template-id={template.id}
    >
      <span
        aria-label={canDrag ? '드래그 핸들' : '드래그 핸들(사용 불가)'}
        {...attributes}
        {...(canDrag ? listeners : {})}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className={`touch-none flex h-10 w-6 shrink-0 items-center justify-center self-stretch select-none rounded-md border text-sm leading-none ${
          isDragging
            ? 'cursor-grabbing border-blue-300 bg-blue-50 text-blue-700'
            : canDrag
              ? 'cursor-grab border-gray-200 bg-gray-50 text-gray-500'
              : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
        }`}
      >
        <svg aria-hidden="true" className="h-4 w-2" viewBox="0 0 8 16" fill="currentColor">
          <circle cx="4" cy="3" r="1" />
          <circle cx="4" cy="8" r="1" />
          <circle cx="4" cy="13" r="1" />
        </svg>
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
        aria-label={
          activeDeletingId === template.id
            ? '템플릿 삭제 중'
            : savingOrder
              ? '순서 저장 중에는 삭제할 수 없음'
              : '템플릿 삭제'
        }
        disabled={activeDeletingId !== null || savingOrder}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDelete(template);
        }}
        title={savingOrder ? '순서 저장 중에는 삭제할 수 없습니다' : '삭제'}
        className={`ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed ${
          savingOrder
            ? 'border-red-200 bg-red-50 text-red-600 opacity-35'
            : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60'
        }`}
      >
        {activeDeletingId === template.id ? (
          <span
            aria-hidden="true"
            className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent"
          />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 7h12m-9 0V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0v12a2 2 0 002 2h4a2 2 0 002-2V7"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

export function useTemplatePicker() {
  const openTemplatePickerModal = useCallback(
    () =>
      overlay.openAsync<Template | null>(({ isOpen, close, unmount }) => (
        <TemplatePickerModal
          isOpen={isOpen}
          onAfterClose={unmount}
          onClose={() => close(null)}
          onSelect={(template) => close(template)}
        />
      )),
    []
  );

  return { openTemplatePickerModal };
}

function TemplatePickerModal({
  isOpen,
  onAfterClose,
  onClose,
  onSelect,
}: TemplatePickerModalProps) {
  const queryClient = useQueryClient();
  const {
    data: templatesData,
    isPending: isLoading,
    isFetching,
    error: templatesError,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 1 * 60 * 1000,
  });

  const templates = templatesData ?? EMPTY_TEMPLATES;
  const errorMessage = templatesError ? (templatesError as Error).message : undefined;
  const [orderedTemplateIds, setOrderedTemplateIds] = useState<string[] | null>(null);
  const [skipClickId, setSkipClickId] = useState<string | null>(null);
  const [localSavingOrder, setLocalSavingOrder] = useState(false);
  const [localDeletingId, setLocalDeletingId] = useState<string | null>(null);

  const queuedReorderIdsRef = useRef<string[] | null>(null);

  const filtered = useMemo(
    () => orderTemplates(templates, orderedTemplateIds),
    [orderedTemplateIds, templates]
  );
  const orderedIds = useMemo(() => filtered.map((item) => item.id), [filtered]);

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.reorderTemplates(ids);
      return ids;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previous = queryClient.getQueryData<Template[]>(['templates']) ?? [];
      queryClient.setQueryData(['templates'], reorderTemplatesInCache(previous, ids));
      setOrderedTemplateIds(ids);
      return undefined;
    },
    onError: async (error) => {
      await showAlert('템플릿 순서 저장에 실패했습니다: ' + (error as Error).message);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      setOrderedTemplateIds(null);
      setLocalSavingOrder(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteTemplate(id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previous = queryClient.getQueryData<Template[]>(['templates']) ?? [];
      queryClient.setQueryData(['templates'], previous.filter((item) => item.id !== id));
      setOrderedTemplateIds((prev) => {
        if (!prev) return prev;
        return prev.filter((templateId) => templateId !== id);
      });
      setLocalDeletingId(id);
      if (queuedReorderIdsRef.current) {
        queuedReorderIdsRef.current = queuedReorderIdsRef.current.filter((queuedId) => queuedId !== id);
      }
      return { previous };
    },
    onError: async (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['templates'], context.previous);
      }
      await showAlert('템플릿 삭제에 실패했습니다: ' + (error as Error).message);
    },
    onSettled: async () => {
      setLocalDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const savingOrder = localSavingOrder || reorderMutation.isPending;
  const activeDeletingId = localDeletingId;
  const canDrag = !isLoading && !errorMessage && !activeDeletingId;
  const isHeaderLoading = !!templatesData && !errorMessage && (savingOrder || isFetching);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const startReorderPersist = useCallback(
    (candidateIds: string[]) => {
      const cached = queryClient.getQueryData<Template[]>(['templates']) ?? templates;
      const payload = buildReorderPayload(candidateIds, cached);
      if (!payload.length) return;
      if (areSameOrder(payload, cached.map((item) => item.id))) return;

      setLocalSavingOrder(true);
      reorderMutation.mutate(payload);
    },
    [queryClient, reorderMutation, templates]
  );

  const requestPersistReorder = useCallback(
    (candidateIds: string[]) => {
      if (activeDeletingId || reorderMutation.isPending) {
        queuedReorderIdsRef.current = candidateIds;
        return;
      }
      startReorderPersist(candidateIds);
    },
    [activeDeletingId, reorderMutation.isPending, startReorderPersist]
  );

  useEffect(() => {
    if (activeDeletingId || reorderMutation.isPending) return;
    const queued = queuedReorderIdsRef.current;
    if (!queued || !queued.length) return;
    queuedReorderIdsRef.current = null;
    startReorderPersist(queued);
  }, [activeDeletingId, reorderMutation.isPending, startReorderPersist]);

  const handleDragCancel = useCallback(() => {
    // no-op; kept for explicit drag lifecycle handling.
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;

      if (!overId || activeId === overId) return;

      const sourceIndex = orderedIds.indexOf(activeId);
      const targetIndex = orderedIds.indexOf(overId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const nextIds = arrayMove(orderedIds, sourceIndex, targetIndex);
      setOrderedTemplateIds(nextIds);
      setSkipClickId(activeId);
      requestPersistReorder(nextIds);
    },
    [orderedIds, requestPersistReorder]
  );

  const handleTemplateClick = (template: Template) => {
    if (skipClickId === template.id) {
      setSkipClickId(null);
      return;
    }
    onSelect(template);
  };

  const handleDeleteTemplate = async (template: Template) => {
    if (activeDeletingId || savingOrder) return;

    const confirmed = await showConfirm(`"${template.name}" 템플릿을 삭제할까요?`, {
      primaryLabel: '삭제',
      secondaryLabel: '취소',
      tone: 'danger',
    });
    if (!confirmed) return;

    deleteMutation.mutate(template.id);
  };

  const getSubtitle = (template: Template) => {
    const parts = [template.memo, template.method, template.category].filter(Boolean);
    if (parts.length === 0) return '입력값 없음';
    return parts.join(' · ');
  };

  const getAmountLabel = (template: Template) => {
    if (template.amount === null) return '금액 없음';
    return `${Math.abs(template.amount).toLocaleString()}원`;
  };

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
      onBackdropClick={onClose}
      overlayClassName="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      panelClassName="flex w-full max-w-none max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
    >
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">템플릿 선택</h3>
          <span
            className="inline-flex h-4 w-4 items-center justify-center"
            aria-label={isHeaderLoading ? '템플릿 동기화 중' : undefined}
          >
            {isHeaderLoading && (
              <span
                aria-hidden="true"
                className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"
              />
            )}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isLoading && <p className="px-2 py-3 text-sm text-gray-500">불러오는 중...</p>}
        {!isLoading && errorMessage && <p className="px-2 py-3 text-sm text-red-600">{errorMessage}</p>}
        {!isLoading && !errorMessage && filtered.length === 0 && (
          <p className="px-2 py-3 text-sm text-gray-500">템플릿이 없습니다.</p>
        )}
        {!isLoading && !errorMessage && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {filtered.map((template) => (
                <SortableTemplateRow
                  key={template.id}
                  template={template}
                  canDrag={canDrag}
                  savingOrder={savingOrder}
                  activeDeletingId={activeDeletingId}
                  onTemplateClick={handleTemplateClick}
                  onDelete={(item) => {
                    void handleDeleteTemplate(item);
                  }}
                  getSubtitle={getSubtitle}
                  getAmountLabel={getAmountLabel}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ModalShell.Footer className="border-gray-200 px-4 pt-3 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          닫기
        </button>
      </ModalShell.Footer>
    </ModalShell>
  );
}

export default TemplatePickerModal;

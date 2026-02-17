/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

interface ReorderState {
  debounceTimer: number | null;
  controller: AbortController | null;
  latestIds: string[];
  token: number;
  pending: {
    token: number;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null;
}

async function fetchTemplates() {
  const response = await api.getTemplates();
  return response.data || [];
}

function createAbortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
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
    error: templatesError,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchTemplates,
    staleTime: 1 * 60 * 1000,
  });
  const templates = templatesData ?? EMPTY_TEMPLATES;
  const errorMessage = templatesError ? (templatesError as Error).message : undefined;
  const [orderedTemplateIds, setOrderedTemplateIds] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [skipClickId, setSkipClickId] = useState<string | null>(null);
  const [localSavingOrder, setLocalSavingOrder] = useState(false);
  const [localDeletingId, setLocalDeletingId] = useState<string | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastHoverTargetIdRef = useRef<string | null>(null);
  const lastMovedOrderIdsRef = useRef<string[] | null>(null);
  const didMoveRef = useRef(false);
  const reorderStateRef = useRef<ReorderState>({
    debounceTimer: null,
    controller: null,
    latestIds: [],
    token: 0,
    pending: null,
  });

  const filtered = useMemo(
    () => orderTemplates(templates, orderedTemplateIds),
    [orderedTemplateIds, templates]
  );
  const orderedIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const canDrag = !isLoading && !errorMessage;
  const savingOrder = localSavingOrder;
  const activeDeletingId = localDeletingId;

  const getSubtitle = (template: Template) => {
    const parts = [template.memo, template.method, template.category].filter(Boolean);
    if (parts.length === 0) return '입력값 없음';
    return parts.join(' · ');
  };

  const getAmountLabel = (template: Template) => {
    if (template.amount === null) return '금액 없음';
    return `${Math.abs(template.amount).toLocaleString()}원`;
  };

  const moveTemplate = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setOrderedTemplateIds((previousIds) => {
      const current = orderTemplates(templates, previousIds);
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return previousIds;

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      const nextIds = next.map((item) => item.id);
      lastMovedOrderIdsRef.current = nextIds;
      return nextIds;
    });
  };

  useEffect(() => {
    lastMovedOrderIdsRef.current = null;
  }, [templates]);

  const handleTemplateClick = (template: Template) => {
    if (skipClickId === template.id) {
      setSkipClickId(null);
      return;
    }
    onSelect(template);
  };

  const reorderTemplates = useCallback(
    (ids: string[]) =>
      new Promise<void>((resolve, reject) => {
        const state = reorderStateRef.current;
        const token = state.token + 1;
        state.token = token;
        state.latestIds = ids;
        if (state.pending) {
          state.pending.reject(createAbortError());
        }
        state.pending = {
          token,
          resolve,
          reject: (error) => reject(error),
        };

        queryClient.setQueryData(['templates'], (old: Template[] = []) => {
          if (!old.length) return old;
          const byId = new Map(old.map((item) => [item.id, item]));
          const ordered = ids
            .map((id, index) => {
              const found = byId.get(id);
              if (!found) return null;
              return { ...found, sortOrder: index + 1 };
            })
            .filter(Boolean) as Template[];
          const remain = old.filter((item) => !ids.includes(item.id));
          return [...ordered, ...remain];
        });

        if (state.debounceTimer !== null) {
          window.clearTimeout(state.debounceTimer);
          state.debounceTimer = null;
        }

        if (state.controller) {
          state.controller.abort();
          state.controller = null;
        }

        state.debounceTimer = window.setTimeout(() => {
          const current = reorderStateRef.current;
          const controller = new AbortController();
          current.controller = controller;
          const payload = [...current.latestIds];

          void api
            .reorderTemplates(payload, controller.signal)
            .then(() => {
              if (current.pending?.token === token) {
                current.pending.resolve();
              }
            })
            .catch(async (error: any) => {
              if (error?.name === 'AbortError') {
                if (current.pending?.token === token) {
                  current.pending.reject(createAbortError());
                }
                return;
              }
              if (current.pending?.token === token) {
                current.pending.reject(error instanceof Error ? error : new Error(String(error)));
              }
              await queryClient.invalidateQueries({ queryKey: ['templates'] });
              await showAlert('템플릿 순서 저장에 실패했습니다: ' + error.message);
            })
            .finally(() => {
              if (current.controller === controller) {
                current.controller = null;
              }
              if (current.pending?.token === token) {
                current.pending = null;
              }
            });
        }, 180);
      }),
    [queryClient]
  );

  const persistReorder = (ids: string[]) => {
    const requestToken = reorderStateRef.current.token + 1;
    setLocalSavingOrder(true);
    void Promise.resolve(reorderTemplates(ids))
      .catch(() => {
        // 오류 알림은 내부 reorderTemplates에서 처리한다.
      })
      .finally(() => {
        if (reorderStateRef.current.token !== requestToken) return;
        setLocalSavingOrder(false);
      });
  };

  const deleteTemplate = useCallback(
    async (template: Template) => {
      if (
        !(await showConfirm(`"${template.name}" 템플릿을 삭제할까요?`, {
          primaryLabel: '삭제',
          secondaryLabel: '취소',
          tone: 'danger',
        }))
      ) {
        return false;
      }

      try {
        await api.deleteTemplate(template.id);
        queryClient.setQueryData(['templates'], (old: Template[] = []) =>
          old.filter((item) => item.id !== template.id)
        );
        await queryClient.invalidateQueries({ queryKey: ['templates'] });
        return true;
      } catch (error: any) {
        await showAlert('템플릿 삭제에 실패했습니다: ' + error.message);
        return false;
      }
    },
    [queryClient]
  );

  const handleDeleteTemplate = (template: Template) => {
    if (activeDeletingId) return;

    setLocalDeletingId(template.id);
    void Promise.resolve(deleteTemplate(template))
      .then((deleted) => {
        if (!deleted) return;
        setOrderedTemplateIds((previous) => {
          if (!previous) return previous;
          return previous.filter((id) => id !== template.id);
        });
      })
      .finally(() => {
        setLocalDeletingId(null);
      });
  };

  useEffect(() => {
    const state = reorderStateRef.current;
    return () => {
      if (state.debounceTimer !== null) {
        window.clearTimeout(state.debounceTimer);
        state.debounceTimer = null;
      }
      if (state.controller) {
        state.controller.abort();
        state.controller = null;
      }
      if (state.pending) {
        state.pending.reject(createAbortError());
        state.pending = null;
      }
    };
  }, []);

  return (
    <ModalShell
      open={isOpen}
      onAfterClose={onAfterClose}
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
                  lastHoverTargetIdRef.current = null;
                  lastMovedOrderIdsRef.current = null;
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
                  if (lastHoverTargetIdRef.current === targetId) return;
                  lastHoverTargetIdRef.current = targetId;
                  didMoveRef.current = true;
                  moveTemplate(draggingId, targetId);
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  if (dragPointerIdRef.current !== event.pointerId) return;
                  const moved = didMoveRef.current;
                  dragPointerIdRef.current = null;
                  lastHoverTargetIdRef.current = null;
                  didMoveRef.current = false;
                  setDraggingId(null);
                  if (moved) {
                    setSkipClickId(template.id);
                    persistReorder(lastMovedOrderIdsRef.current ?? orderedIds);
                  }
                  lastMovedOrderIdsRef.current = null;
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerCancel={() => {
                  dragPointerIdRef.current = null;
                  lastHoverTargetIdRef.current = null;
                  lastMovedOrderIdsRef.current = null;
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
                {savingOrder ? (
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
                disabled={activeDeletingId === template.id}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleDeleteTemplate(template);
                }}
                className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeDeletingId === template.id ? (
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

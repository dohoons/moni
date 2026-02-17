import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { overlay } from 'overlay-kit';
import TemplatePickerModal from '../components/TemplatePickerModal';
import TemplateSaveModal from '../components/TemplateSaveModal';
import { api, type Template, type TemplateDraft } from '../services/api';
import { showAlert, showConfirm } from '../services/message-dialog';

export function useTemplate() {
  const queryClient = useQueryClient();
  const reorderDebounceRef = useRef<number | null>(null);
  const reorderAbortRef = useRef<AbortController | null>(null);
  const latestOrderRef = useRef<string[]>([]);

  const {
    data: templates = [],
    isPending: isTemplatesLoading,
    error: templatesError,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.getTemplates();
      return response.data || [];
    },
    staleTime: 1 * 60 * 1000,
  });

  const saveTemplate = useCallback(
    async (draft: TemplateDraft) => {
      await api.createTemplate(draft);
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      await showAlert('템플릿으로 저장했습니다.');
    },
    [queryClient]
  );

  const reorderTemplates = useCallback(
    (ids: string[]) => {
      latestOrderRef.current = ids;

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

      if (reorderDebounceRef.current !== null) {
        window.clearTimeout(reorderDebounceRef.current);
        reorderDebounceRef.current = null;
      }

      if (reorderAbortRef.current) {
        reorderAbortRef.current.abort();
        reorderAbortRef.current = null;
      }

      reorderDebounceRef.current = window.setTimeout(() => {
        const controller = new AbortController();
        reorderAbortRef.current = controller;
        const payload = [...latestOrderRef.current];

        void api
          .reorderTemplates(payload, controller.signal)
          .catch(async (error: any) => {
            if (error?.name === 'AbortError') return;
            await queryClient.invalidateQueries({ queryKey: ['templates'] });
            await showAlert('템플릿 순서 저장에 실패했습니다: ' + error.message);
          })
          .finally(() => {
            if (reorderAbortRef.current === controller) {
              reorderAbortRef.current = null;
            }
          });
      }, 180);
    },
    [queryClient]
  );

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
        await queryClient.invalidateQueries({ queryKey: ['templates'] });
        return true;
      } catch (error: any) {
        await showAlert('템플릿 삭제에 실패했습니다: ' + error.message);
        return false;
      }
    },
    [queryClient]
  );

  const pickTemplate = useCallback(
    () =>
      overlay.openAsync<Template | null>(({ isOpen, close, unmount }) => (
        <TemplatePickerModal
          isOpen={isOpen}
          onAfterClose={unmount}
          templates={templates}
          isLoading={isTemplatesLoading}
          errorMessage={templatesError ? (templatesError as Error).message : undefined}
          onClose={() => close(null)}
          onSelect={(template) => close(template)}
          onReorder={reorderTemplates}
          onDelete={deleteTemplate}
        />
      )),
    [templates, isTemplatesLoading, templatesError, reorderTemplates, deleteTemplate]
  );

  const openTemplateSaveModal = useCallback(
    ({
      hasAmount,
      onSubmit,
    }: {
      hasAmount: boolean;
      onSubmit: (payload: { name: string; includeAmount: boolean }) => Promise<void>;
    }) =>
      overlay.openAsync<void>(({ isOpen, close, unmount }) => (
        <TemplateSaveModal
          isOpen={isOpen}
          hasAmount={hasAmount}
          onClose={() => close(undefined)}
          onAfterClose={unmount}
          onSubmit={async (payload) => {
            await onSubmit(payload);
            close(undefined);
          }}
        />
      )),
    []
  );

  useEffect(() => {
    return () => {
      if (reorderDebounceRef.current !== null) {
        window.clearTimeout(reorderDebounceRef.current);
        reorderDebounceRef.current = null;
      }
      if (reorderAbortRef.current) {
        reorderAbortRef.current.abort();
        reorderAbortRef.current = null;
      }
    };
  }, []);

  return {
    templates,
    isTemplatesLoading,
    templatesError,
    saveTemplate,
    reorderTemplates,
    deleteTemplate,
    pickTemplate,
    openTemplateSaveModal,
  };
}

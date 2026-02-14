import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useSync } from '../hooks/useSync';
import { useAuth } from '../contexts/AuthContext';
import SmartEntry from '../components/SmartEntry';
import DetailEntry, { type Record } from '../components/DetailEntry';
import SyncIndicator from '../components/SyncIndicator';
import SyncQueueModal from '../components/SyncQueueModal';
import type { ParsedInput } from '../lib/parser';
import { WEEKDAYS } from '../constants';
import { showAlert, showConfirm } from '../services/message-dialog';

// 날짜 포맷 함수 (1월 15일 같은 형식)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

const PAGE_SIZE = 40;

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [showDetailEntry, setShowDetailEntry] = useState(false);
  const [editRecord, setEditRecord] = useState<Record | null>(null);
  const [quickParsed, setQuickParsed] = useState<ParsedInput | null>(null);
  const [quickEntryResetSignal, setQuickEntryResetSignal] = useState(0);
  const [showSyncQueueModal, setShowSyncQueueModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const scrollAnchorRef = useRef<{ id: string; top: number } | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  // Intersection Observer용 ref
  const observerTarget = useRef<HTMLDivElement>(null);

  const { createRecord, updateRecord, deleteRecord, isOnline, pendingCount } = useSync();

  const findRecordElementById = useCallback((id: string): HTMLElement | null => {
    const elements = document.querySelectorAll<HTMLElement>('[data-record-id]');
    for (const element of elements) {
      if (element.dataset.recordId === id) {
        return element;
      }
    }
    return null;
  }, []);

  const captureScrollAnchor = useCallback(() => {
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const elements = document.querySelectorAll<HTMLElement>('[data-record-id]');

    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom > headerBottom + 8 && rect.top < window.innerHeight) {
        const id = element.dataset.recordId;
        if (id) {
          scrollAnchorRef.current = { id, top: rect.top };
        }
        return;
      }
    }
  }, []);

  const restoreScrollAnchor = useCallback(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;

    const restore = () => {
      const target = findRecordElementById(anchor.id);
      if (!target) return;
      const currentTop = target.getBoundingClientRect().top;
      const delta = currentTop - anchor.top;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta });
      }
    };

    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(() => {
        restore();
        scrollAnchorRef.current = null;
      });
    });
  }, [findRecordElementById]);

  // Records Query - React Query로 캐싱
  const {
    data: records = [],
    isPending,
    error,
    refetch: loadRecords,
  } = useQuery({
    queryKey: ['records'],
    queryFn: async () => {
      const response = await api.getRecords({ limit: PAGE_SIZE });
      if (response.data) {
        if (response.data.length > 0) {
          const lastRecord = response.data[response.data.length - 1];
          setCursor(`${lastRecord.date}|${lastRecord.id}`);
          setHasMore(response.data.length === PAGE_SIZE);
        } else {
          setHasMore(false);
        }
        return response.data;
      }
      return [];
    },
    staleTime: 1 * 60 * 1000, // 1분 캐시
  });

  // 레코드를 일자별로 그룹화
  const groupedRecords = useMemo(() => {
    const groups: { [key: string]: (Record & { _isSaving?: boolean })[] } = {};
    records.forEach((record: any) => {
      const r = record as Record & { _isSaving?: boolean };
      if (!groups[r.date]) {
        groups[r.date] = [];
      }
      groups[r.date].push(r);
    });
    // 날짜 내림차순 정렬 (최신 날짜 먼저)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)) as [string, (Record & { _isSaving?: boolean })[]][];
  }, [records]);

  // 추가 로드
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;

    setLoadingMore(true);
    try {
      const response = await api.getRecords({ limit: PAGE_SIZE, cursor });
      if (response.data) {
        if (response.data.length > 0) {
          const lastRecord = response.data[response.data.length - 1];
          setCursor(`${lastRecord.date}|${lastRecord.id}`);
          setHasMore(response.data.length === PAGE_SIZE);
          // 기존 데이터에 추가
          queryClient.setQueryData(['records'], (old: Record[] = []) => [...old, ...response.data]);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Failed to load more records:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, queryClient]);

  // Intersection Observer 설정
  useEffect(() => {
    if (!observerTarget.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(observerTarget.current);

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loadingMore, loadMore]);

  const handleSetup = async () => {
    try {
      const response = await api.setup();
      if (response.success) {
        await showAlert('Google 시트가 생성되었습니다!');
        setSetupRequired(false);
        await loadRecords();
      }
    } catch (error: any) {
      console.error('Setup failed:', error);
      await showAlert('설정에 실패했습니다: ' + error.message);
    }
  };

  const handleLogout = async () => {
    if (!(await showConfirm('로그아웃하시겠습니까?'))) {
      return;
    }
    logout();
    navigate('/login', { replace: true });
  };

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await loadRecords();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadRecords]);

  const handleMainTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (window.scrollY > 2 || isRefreshing) return;
    if (e.touches.length !== 1) return;

    pullStartYRef.current = e.touches[0].clientY;
    isPullingRef.current = false;
  }, [isRefreshing]);

  const handleMainTouchMove = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (pullStartYRef.current === null) return;
    if (window.scrollY > 2) return;

    const deltaY = e.touches[0].clientY - pullStartYRef.current;
    if (deltaY <= 0) return;

    isPullingRef.current = true;
    const nextDistance = Math.min(96, deltaY * 0.45);
    setPullDistance(nextDistance);

    if (e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const handleMainTouchEnd = useCallback(() => {
    const shouldRefresh = isPullingRef.current && pullDistance >= 56;

    pullStartYRef.current = null;
    isPullingRef.current = false;
    setPullDistance(0);

    if (shouldRefresh) {
      void handleManualRefresh();
    }
  }, [pullDistance, handleManualRefresh]);

  const handleEntrySubmit = async (parsed: ParsedInput) => {
    // 빠른기록 입력창/파싱 상태 초기화 (상세기록에서 전송한 경우 포함)
    setQuickParsed(null);
    setQuickEntryResetSignal((prev) => prev + 1);

    // 즉시 다이얼로그 닫기
    setShowDetailEntry(false);
    setEditRecord(null);

    const date = new Date().toISOString().split('T')[0];
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 낙관적 업데이트: 목록에 즉시 추가
    const optimisticRecord: Record = {
      id: tempId,
      date,
      amount: parsed.amount,
      memo: parsed.memo || '',
      method: parsed.method || null,
      category: parsed.category || null,
      created: new Date().toISOString(),
    };

    // 캐시에 즉시 추가 (loading 상태로 표시하기 위해 _isSaving 속성 추가)
    queryClient.setQueryData(['records'], (old: Record[] = []) => {
      return [{ ...optimisticRecord, _isSaving: true } as Record & { _isSaving?: boolean }, ...old];
    });

    try {
      const result = await createRecord(parsed, tempId);

      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      // 온라인 저장 시 임시 ID를 실제 ID로 즉시 교체 (수정 시 Record not found 방지)
      queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean })[] = []) => {
        return old.map(r => {
          if (r.id !== tempId) return r;
          return {
            ...r,
            id: result.createdId || r.id,
            _isSaving: false,
          };
        });
      });
    } catch (error: any) {
      console.error('Failed to create record:', error);
      await showAlert('기록 저장에 실패했습니다: ' + error.message);
      // 실패 시 목록에서 제거
      queryClient.setQueryData(['records'], (old: Record[] = []) => {
        return old.filter(r => r.id !== tempId);
      });
    }
  };

  const handleUpdate = async (id: string, parsed: Partial<ParsedInput>, date: string) => {
    captureScrollAnchor();

    // 즉시 다이얼로그 닫기
    setShowDetailEntry(false);
    setEditRecord(null);

    // 원본 레코드 저장 (롤백용)
    queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean })[] = []) => {
      return old.map(r => r.id === id ? { ...r, _original: { ...r }, _isSaving: true } : r);
    });

    // 낙관적 업데이트: 즉시 반영
    queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean; _original?: any })[] = []) => {
      return old.map(r => {
        if (r.id === id) {
          return {
            ...r,
            amount: parsed.amount !== undefined ? parsed.amount : r.amount,
            memo: parsed.memo !== undefined ? (parsed.memo || '') : r.memo,
            method: parsed.method !== undefined ? parsed.method : r.method,
            category: parsed.category !== undefined ? parsed.category : r.category,
            date,
            _isSaving: true,
          };
        }
        return r;
      });
    });

    try {
      const result = await updateRecord(id, { ...parsed, date });

      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      // 저장 완료 후 로딩 상태 제거
      queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean; _original?: any })[] = []) => {
        return old.map(r => r.id === id ? { ...r, _isSaving: false, _original: undefined } : r);
      });
      restoreScrollAnchor();
    } catch (error: any) {
      console.error('Failed to update record:', error);
      await showAlert('기록 수정에 실패했습니다: ' + error.message);
      // 실패 시 롤백
      queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean; _original?: any })[] = []) => {
        return old.map(r => r._original && r.id === id ? r._original : r);
      });
      restoreScrollAnchor();
    }
  };

  const handleDelete = async (id: string) => {
    // 즉시 다이얼로그 닫기
    setShowDetailEntry(false);
    setEditRecord(null);

    // 원본 레코드 저장 (롤백용) + 로딩 상태 표시
    queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean; _original?: any })[] = []) => {
      return old.map(r => r.id === id ? { ...r, _original: { ...r }, _isSaving: true } : r);
    });

    try {
      const result = await deleteRecord(id);

      if (result.queued) {
        await showAlert('오프라인 상태입니다. 동기화 대기열에 추가되었습니다.');
      }

      // 성공 시 목록에서 완전히 제거
      queryClient.setQueryData(['records'], (old: Record[] = []) => {
        return old.filter(r => r.id !== id);
      });
    } catch (error: any) {
      console.error('Failed to delete record:', error);
      await showAlert('기록 삭제에 실패했습니다: ' + error.message);
      // 실패 시 롤백
      queryClient.setQueryData(['records'], (old: (Record & { _isSaving?: boolean; _original?: any })[] = []) => {
        return old.map(r => r._original && r.id === id ? { ...r._original, _isSaving: false } : r);
      });
    }
  };

  const handleRecordClick = (record: Record) => {
    setQuickParsed(null);
    setEditRecord(record);
    setShowDetailEntry(true);
  };

  const handleModalClose = () => {
    setShowDetailEntry(false);
    setEditRecord(null);
  };

  if (setupRequired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Moni</h1>
            <p className="text-gray-600">Google 시트를 생성해야 합니다</p>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="p-8 text-center">
              <div className="mb-6 flex justify-center">
                <div className="rounded-full bg-blue-100 p-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>

              <button
                onClick={handleSetup}
                disabled={isPending}
                className="w-full rounded-xl bg-blue-600 px-6 py-4 font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isPending ? '생성 중...' : '시트 생성'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur safe-area-top">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Moni</h1>
                <div className="relative">
                  <span
                    className={`block h-2 w-2 rounded-full ${
                      isOnline ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  {isOnline && (
                    <span className="absolute inset-0 block h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {isOnline ? '온라인' : '오프라인'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/archive')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4"
              >
                <span className="hidden sm:inline">월별</span>
                <svg className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => navigate('/stats')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4"
              >
                <span className="hidden sm:inline">통계</span>
                <svg className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
              <button
                onClick={() => void handleManualRefresh()}
                disabled={isRefreshing}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
              >
                <span className="hidden sm:inline">{isRefreshing ? '새로고침 중' : '새로고침'}</span>
                <svg className={`h-5 w-5 sm:hidden ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:px-4"
              >
                <span className="hidden sm:inline">로그아웃</span>
                <svg className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="mx-auto max-w-2xl px-4 safe-area-header pb-6 sm:px-6"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
        onTouchCancel={handleMainTouchEnd}
      >
        {(pullDistance > 0 || isRefreshing) && (
          <div className="mb-3 flex justify-center">
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
              {isRefreshing
                ? '새로고침 중...'
                : pullDistance >= 56
                  ? '손을 놓으면 새로고침'
                  : '아래로 당겨서 새로고침'}
            </div>
          </div>
        )}
        {pendingCount > 0 && (
          <SyncIndicator onRecordsUpdated={loadRecords} onQueueOpen={() => setShowSyncQueueModal(true)} />
        )}

        {/* Quick Entry Section */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">빠른 기록</h2>
            <button
              onClick={() => {
                setEditRecord(null);
                setShowDetailEntry(true);
              }}
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              상세 기록
            </button>
          </div>
          <SmartEntry
            onSubmit={handleEntrySubmit}
            onParsedChange={setQuickParsed}
            resetSignal={quickEntryResetSignal}
          />
        </section>

        {/* Recent Records Section */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">최근 기록</h3>
          {isPending && !records.length ? (
            <div className="space-y-6">
              {/* 스켈레톤: 3개 날짜 그룹 */}
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="mb-3 px-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    {/* 스켈레톤: 각 날짜별 2-3개 아이템 */}
                    {Array.from({ length: i % 2 + 2 }).map((_, j) => (
                      <div key={j} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                        <div className="flex-1">
                          <div className="mb-1 h-5 w-32 animate-pulse rounded bg-gray-200" />
                          <div className="flex gap-2">
                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                            <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
                          </div>
                        </div>
                        <div className="ml-4 h-5 w-20 animate-pulse rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error && !records.length ? (
            <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
              <div className="text-center">
                <svg className="mx-auto mb-3 h-12 w-12 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-gray-500">기록을 불러오는데 실패했습니다.</p>
                <p className="mt-1 text-xs text-gray-400">{error.message}</p>
                <button
                  onClick={() => void handleManualRefresh()}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : !records.length ? (
            <div className="flex items-center justify-center rounded-xl bg-white py-12 shadow-sm">
              <div className="text-center">
                <svg className="mx-auto mb-3 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-gray-500">아직 기록이 없습니다.</p>
                <p className="mt-1 text-xs text-gray-400">위에서 첫 기록을 추가해보세요!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedRecords.map(([date, dateRecords]) => (
                <div key={date}>
                  {/* 날짜 소제목 */}
                  <h4 className="mb-3 px-1 text-sm font-semibold text-gray-500">
                    {formatDate(date)}
                  </h4>
                  {/* 해당 날짜의 레코드들 */}
                  <div className="space-y-2">
                    {dateRecords.map((record) => {
                      const isSaving = (record as any)._isSaving;
                      return (
                        <div
                          key={record.id}
                          data-record-id={record.id}
                          onClick={() => !isSaving && handleRecordClick(record)}
                          className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all sm:p-4 ${
                            isSaving ? 'cursor-default opacity-75' : 'cursor-pointer hover:shadow-md'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {isSaving && (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                              )}
                              <p className={`font-medium sm:text-base ${isSaving ? 'text-gray-400' : 'text-gray-900'}`}>
                                {record.memo || '-'}
                              </p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              {record.category && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  #{record.category}
                                </span>
                              )}
                            {record.method && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-gray-600">
                                {record.method}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`ml-4 text-right font-bold sm:text-base ${isSaving ? 'text-gray-400' : (record.amount > 0 ? 'text-emerald-600' : 'text-slate-700')}`}>
                          {record.amount > 0 ? '+' : ''}{Math.abs(record.amount).toLocaleString()}원
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Intersection Observer 타겟 + 로딩 표시 */}
              <div ref={observerTarget} className="space-y-2 py-6">
                {loadingMore && (
                  <>
                    {/* 스켈레톤: 2개 아이템 */}
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                        <div className="flex-1">
                          <div className="mb-1 h-5 w-32 animate-pulse rounded bg-gray-200" />
                          <div className="flex gap-2">
                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
                            <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200" />
                          </div>
                        </div>
                        <div className="ml-4 h-5 w-20 animate-pulse rounded bg-gray-200" />
                      </div>
                    ))}
                  </>
                )}
                {!hasMore && records.length > 0 && !loadingMore && (
                  <p className="text-center text-xs text-gray-400">모든 기록을 불러왔습니다</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Detail Entry Modal */}
      <DetailEntry
        isOpen={showDetailEntry}
        editRecord={editRecord}
        initialParsed={editRecord ? null : quickParsed}
        onClose={handleModalClose}
        onSubmit={handleEntrySubmit}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Sync Queue Modal */}
      <SyncQueueModal
        isOpen={showSyncQueueModal}
        onClose={() => setShowSyncQueueModal(false)}
        onRecordsUpdated={loadRecords}
      />
    </div>
  );
}

export default Home;

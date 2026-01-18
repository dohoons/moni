/**
 * GET /api/stats
 *
 * 통계 조회
 *
 * Query Params:
 * - year: 연도 (기본값: 현재 연도)
 * - month: 월 (기본값: 현재 월)
 */
function handleGetStats(e, accessToken) {
  requireAuth(accessToken);  // Google OAuth 토큰 검증

  const now = new Date();
  const year = e.parameter.year ? parseInt(e.parameter.year) : now.getFullYear();
  const month = e.parameter.month ? parseInt(e.parameter.month) : now.getMonth() + 1;

  const stats = getAllStats(year, month);

  return successResponse(stats);
}

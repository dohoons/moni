/**
 * GET /api/records
 *
 * 기록 목록 조회
 */
function handleListRecords(e, accessToken) {
  requireAuth(accessToken);  // Google OAuth 토큰 검증

  const params = {};

  if (e.parameter.startDate) {
    params.startDate = e.parameter.startDate;
  }

  if (e.parameter.endDate) {
    params.endDate = e.parameter.endDate;
  }

  if (e.parameter.limit) {
    params.limit = parseInt(e.parameter.limit);
  }

  if (e.parameter.cursor) {
    params.cursor = e.parameter.cursor;
  }

  const records = getRecords(params);

  return successResponse(records);
}

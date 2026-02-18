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

/**
 * POST /api/records/search
 *
 * 기록 검색 조회
 */
function handleSearchRecords(e, accessToken) {
  requireAuth(accessToken);

  const params = {};

  if (e.parameter.q) {
    params.q = String(e.parameter.q).trim();
  }

  if (!params.q) {
    return errorResponse('Missing required field: q');
  }

  if (e.parameter.fields !== undefined) {
    params.fields = e.parameter.fields;
  }

  if (e.parameter.limit) {
    params.limit = parseInt(e.parameter.limit, 10);
  }

  if (e.parameter.cursor) {
    params.cursor = e.parameter.cursor;
  }

  const records = searchRecords(params);

  return successResponse(records);
}

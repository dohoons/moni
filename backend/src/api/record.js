/**
 * POST /api/record
 *
 * 기록 생성
 */
function handleCreateRecord(e, accessToken) {
  requireAuth(accessToken);  // Google OAuth 토큰 검증

  const data = JSON.parse(e.postData.contents);

  // 필수 필드 검증
  if (!data.date || data.amount === undefined) {
    return errorResponse('Missing required fields: date, amount');
  }

  const result = createRecord(data);

  return successResponse(result);
}

/**
 * PUT /api/record
 *
 * 기록 수정
 */
function handleUpdateRecord(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);

  // 필수 필드 검증
  if (!data.id) {
    return errorResponse('Missing required field: id');
  }

  const updates = {};
  if (data.date !== undefined) updates.date = data.date;
  if (data.amount !== undefined) updates.amount = data.amount;
  if (data.memo !== undefined) updates.memo = data.memo;
  if (data.method !== undefined) updates.method = data.method;
  if (data.category !== undefined) updates.category = data.category;

  const result = updateRecord(data.id, updates);

  return successResponse(result);
}

/**
 * DELETE /api/record
 *
 * 기록 삭제
 */
function handleDeleteRecord(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);

  // 필수 필드 검증
  if (!data.id) {
    return errorResponse('Missing required field: id');
  }

  const result = deleteRecord(data.id);

  return successResponse(result);
}

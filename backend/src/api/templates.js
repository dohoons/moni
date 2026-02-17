/**
 * GET /api/templates
 *
 * 템플릿 목록 조회
 */
function handleListTemplates(_e, accessToken) {
  requireAuth(accessToken);
  return successResponse(getTemplates());
}

/**
 * POST /api/template
 *
 * 템플릿 생성
 */
function handleCreateTemplate(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);
  const result = createTemplate(data);
  return successResponse(result);
}

/**
 * PUT /api/template
 *
 * 템플릿 수정
 */
function handleUpdateTemplate(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);
  if (!data.id) {
    return errorResponse('Missing required field: id');
  }

  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.amount !== undefined) updates.amount = data.amount;
  if (data.memo !== undefined) updates.memo = data.memo;
  if (data.method !== undefined) updates.method = data.method;
  if (data.category !== undefined) updates.category = data.category;

  const result = updateTemplate(data.id, updates);
  return successResponse(result);
}

/**
 * DELETE /api/template
 *
 * 템플릿 삭제
 */
function handleDeleteTemplate(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);
  if (!data.id) {
    return errorResponse('Missing required field: id');
  }

  const result = deleteTemplate(data.id);
  return successResponse(result);
}

/**
 * POST /api/template/use
 *
 * 템플릿 사용 횟수 반영
 */
function handleMarkTemplateUsed(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);
  if (!data.id) {
    return errorResponse('Missing required field: id');
  }

  const result = markTemplateUsed(data.id);
  return successResponse(result);
}

/**
 * POST /api/template/reorder
 *
 * 템플릿 순서 재정렬
 */
function handleReorderTemplates(e, accessToken) {
  requireAuth(accessToken);

  const data = JSON.parse(e.postData.contents);
  if (!data.ids || !Array.isArray(data.ids)) {
    return errorResponse('Missing required field: ids');
  }

  const result = reorderTemplates(data.ids);
  return successResponse(result);
}

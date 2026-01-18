/**
 * POST /api/setup
 *
 * 시트 초기화 (최초 1회, 자동 호출)
 */
function handleSetup(accessToken) {
  const email = requireAuth(accessToken);  // Google OAuth 토큰 검증

  const spreadsheet = ensureSchema();

  return successResponse({
    spreadsheetId: spreadsheet.getId(),
    sheets: spreadsheet.getSheets().map(s => s.getName()),
    url: spreadsheet.getUrl(),
    user: {
      email: email
    }
  });
}

/**
 * Auth Service
 *
 * Google OAuth Access Token 검증 + 화이트리스트
 */

// 화이트리스트: 본인의 Google 이메일만 허용
const WHITELIST_EMAIL = 'dohoons@gmail.com';  // 본인 이메일로 변경

/**
 * Google Access Token 검증
 *
 * @param {string} accessToken - Google OAuth Access Token
 * @returns {string} 사용자 이메일
 */
function verifyGoogleAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error('Unauthorized: No access token provided');
  }

  // 토큰이 너무 짧으면 잘못된 것
  if (accessToken.length < 50) {
    throw new Error('Invalid access token format (too short): ' + accessToken.substring(0, 10) + '...');
  }

  // Google tokeninfo API로 토큰 검증
  const response = UrlFetchApp.fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`,
    { muteHttpExceptions: true }
  );

  const code = response.getResponseCode();
  const responseText = response.getContentText();

  if (code !== 200) {
    // 에러에 더 많은 정보 포함
    const errorDetails = {
      httpCode: code,
      response: responseText,
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 20) + '...'
    };
    throw new Error(`Token verification failed (HTTP ${code}): ${responseText} | Details: ${JSON.stringify(errorDetails)}`);
  }

  const data = JSON.parse(responseText);

  // 토큰의 aud가 우리 앱인지 확인 (선택 사항)
  // if (data.aud !== CLIENT_ID) {
  //   throw new Error('Invalid token audience');
  // }

  return data.email;
}

/**
 * 인증 요구 및 화이트리스트 확인
 *
 * @param {string} accessToken - Google OAuth Access Token
 * @returns {string} 사용자 이메일
 */
function requireAuth(accessToken) {
  const email = verifyGoogleAccessToken(accessToken);

  // 화이트리스트 확인
  if (email !== WHITELIST_EMAIL) {
    throw new Error(`Forbidden: ${email} is not authorized`);
  }

  return email;
}

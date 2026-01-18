/**
 * Moni API - Google Apps Script Backend
 *
 * Main Router
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

/**
 * 공통 요청 처리기
 */
function handleRequest(e) {
  let path = null;
  let accessToken = null;
  let bodyData = null;

  // POST 본문에서 JSON 파싱 (text/plain)
  if (e.postData && e.postData.contents) {
    try {
      const payload = JSON.parse(e.postData.contents);
      path = payload.path;
      accessToken = payload.access_token;
      bodyData = payload.body;
    } catch (err) {
      // JSON 파싱 실패
    }
  }

  // GET 파라미터에서 path 추출 (폴백)
  if (!path && e.parameter.path) {
    path = e.parameter.path;
  }

  // path가 없으면 루트 경로로 처리
  if (!path) {
    return successResponse({
      message: 'Moni API - Google Apps Script Backend',
      version: '1.0.0',
      status: 'running'
    });
  }

  let result;
  try {
    switch (path) {
      case '/api/setup':
        result = handleSetup(accessToken);
        break;

      case '/api/record':
        result = handleCreateRecordWithBody(bodyData, accessToken);
        break;

      case '/api/record/update':
        result = handleUpdateRecordWithBody(bodyData, accessToken);
        break;

      case '/api/record/delete':
        result = handleDeleteRecordWithBody(bodyData, accessToken);
        break;

      case '/api/records':
        result = handleListRecordsWithBody(bodyData, accessToken);
        break;

      case '/api/stats':
        result = handleGetStats({ parameter: bodyData || {} }, accessToken);
        break;

      default:
        result = errorResponse('Not Found: ' + path);
    }
  } catch (error) {
    result = errorResponse(error.toString());
  }

  return result;
}

/**
 * 본문 데이터로 기록 생성
 */
function handleCreateRecordWithBody(bodyData, accessToken) {
  if (!bodyData) {
    return errorResponse('Missing request body');
  }

  const mockEvent = {
    postData: {
      contents: JSON.stringify(bodyData)
    }
  };

  return handleCreateRecord(mockEvent, accessToken);
}

/**
 * 본문 데이터로 목록 조회
 */
function handleListRecordsWithBody(bodyData, accessToken) {
  const params = bodyData || {};

  const mockEvent = {
    parameter: params
  };

  return handleListRecords(mockEvent, accessToken);
}

/**
 * 본문 데이터로 기록 수정
 */
function handleUpdateRecordWithBody(bodyData, accessToken) {
  if (!bodyData) {
    return errorResponse('Missing request body');
  }

  const mockEvent = {
    postData: {
      contents: JSON.stringify(bodyData)
    }
  };

  return handleUpdateRecord(mockEvent, accessToken);
}

/**
 * 본문 데이터로 기록 삭제
 */
function handleDeleteRecordWithBody(bodyData, accessToken) {
  if (!bodyData) {
    return errorResponse('Missing request body');
  }

  const mockEvent = {
    postData: {
      contents: JSON.stringify(bodyData)
    }
  };

  return handleDeleteRecord(mockEvent, accessToken);
}

/**
 * JSON 응답 헬퍼
 */

function successResponse(data) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify({
    success: true,
    data: data
  }));
  return output;
}

function errorResponse(error) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify({
    success: false,
    error: error.toString()
  }));
  return output;
}

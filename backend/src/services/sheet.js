/**
 * Sheet Service
 *
 * Google Sheets API 래퍼
 */

const COLUMN_MAP = {
  id: 1,
  date: 2,
  amount: 3,
  memo: 4,
  method: 5,
  category: 6,
  created: 7,
  email: 8
};

/**
 * 데이터 시트 가져오기 (스키마 확인 포함)
 */
function getDataSheet() {
  const spreadsheet = ensureSchema();
  return spreadsheet.getSheetByName('Data');
}

/**
 * 기록 생성
 */
function createRecord(record) {
  const sheet = getDataSheet();
  const userEmail = Session.getActiveUser().getEmail();

  const row = [
    record.id || generateUUID(),
    record.date,
    record.amount,
    record.memo || '',
    record.method || '',
    record.category || '',
    record.created || new Date().toISOString(),
    userEmail  // 사용자 이메일 저장
  ];

  sheet.appendRow(row);
  SpreadsheetApp.flush();  // 즉시 반영

  return {
    id: row[0],
    created: row[6]
  };
}

/**
 * 날짜 파싱 헬퍼 함수
 */
function parseDate(value) {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  if (typeof value === 'string') {
    // YYYY-MM-DD 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // 다른 형식(2026. 1. 18. 등) 파싱
    const parts = value.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
    if (parts) {
       const year = parts[1];
       const month = String(parts[2]).padStart(2, '0');
       const day = String(parts[3]).padStart(2, '0');
       return `${year}-${month}-${day}`;
    }
  }
  return '';
}

/**
 * 기록 목록 조회
 *
 * 커서 방식 페이징: cursor는 "date|id" 형식
 * 예: cursor="2024-01-15|abc123" → 해당 레코드 이전의 항목들 반환
 */
function getRecords(params) {
  const sheet = getDataSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  // 전체 데이터 가져오기 (8열: email 포함)
  const rawData = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  // 모든 데이터를 먼저 객체로 변환 (날짜 정규화 포함)
  let records = rawData.map(row => {
    return {
      id: row[0],
      date: parseDate(row[1]),
      amount: row[2],
      memo: row[3],
      method: row[4],
      category: row[5],
      created: row[6]
    };
  });

  // 날짜 필터링 (정규화된 날짜 문자열로 비교)
  if (params.startDate) {
    records = records.filter(r => r.date >= params.startDate);
  }

  if (params.endDate) {
    records = records.filter(r => r.date <= params.endDate);
  }

  // date 내림차순, created 내림차순 정렬 (생성 순서 보장)
  records.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.created.localeCompare(a.created);
  });

  // 커서 기반 필터링
  let startIndex = 0;
  if (params.cursor) {
    const [cursorDate, cursorId] = params.cursor.split('|');
    // 커서 위치 찾기 (해당 레코드 다음부터)
    const cursorIndex = records.findIndex(r => r.date === cursorDate && r.id === cursorId);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }

  // limit 적용
  const limit = params.limit || 20;
  return records.slice(startIndex, startIndex + limit);
}

/**
 * 기록 수정
 */
function updateRecord(id, updates) {
  const sheet = getDataSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('No records found');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const rowIndex = data.findIndex(row => row[0] === id);
  if (rowIndex === -1) {
    throw new Error('Record not found');
  }

  const rowNum = rowIndex + 2; // 1-based index + header row

  // 업데이트할 필드만 적용
  if (updates.date !== undefined) {
    sheet.getRange(rowNum, COLUMN_MAP.date).setValue(updates.date);
  }
  if (updates.amount !== undefined) {
    sheet.getRange(rowNum, COLUMN_MAP.amount).setValue(updates.amount);
  }
  if (updates.memo !== undefined) {
    sheet.getRange(rowNum, COLUMN_MAP.memo).setValue(updates.memo || '');
  }
  if (updates.method !== undefined) {
    sheet.getRange(rowNum, COLUMN_MAP.method).setValue(updates.method || '');
  }
  if (updates.category !== undefined) {
    sheet.getRange(rowNum, COLUMN_MAP.category).setValue(updates.category || '');
  }

  SpreadsheetApp.flush();  // 즉시 반영

  return { id };
}

/**
 * 기록 삭제
 */
function deleteRecord(id) {
  const sheet = getDataSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('No records found');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const rowIndex = data.findIndex(row => row[0] === id);
  if (rowIndex === -1) {
    throw new Error('Record not found');
  }

  const rowNum = rowIndex + 2; // 1-based index + header row
  sheet.deleteRow(rowNum);
  SpreadsheetApp.flush();  // 즉시 반영

  return { id };
}

/**
 * 통계 계산을 위한 데이터 가져오기
 */
function getAllRecordsForStats() {
  const sheet = getDataSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  return data.map(row => {
    return {
      date: parseDate(row[1]),
      amount: Number(row[2]) || 0,
      category: row[5]
    };
  });
}

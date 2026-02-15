/**
 * Migration Service
 *
 * 사용자별 시트 생성 및 스키마 관리
 */

const SCHEMA_VERSION = 7;
const SPREADSHEET_ID = '1HF7btOFx-5RGanlxw7cYWnQv5vx1murQEuy9lUxbIY0';

/**
 * 스키마 버전 확인 및 마이그레이션 실행
 */
function ensureSchema() {
  const spreadsheet = getSpreadsheet();
  const metaSheet = getOrCreateSheet(spreadsheet, 'Meta');

  const currentVersion = getSchemaVersion(metaSheet);

  if (currentVersion < SCHEMA_VERSION) {
    initializeSchema(spreadsheet);
    setSchemaVersion(metaSheet, SCHEMA_VERSION);
  }

  return spreadsheet;
}

/**
 * 고정된 시트 ID로 스프레드시트 가져오기
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * 시트를 찾거나 생성
 */
function getOrCreateSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

/**
 * 스키마 버전 조회
 */
function getSchemaVersion(metaSheet) {
  if (metaSheet.getLastRow() === 0) {
    return 0;
  }

  const data = metaSheet.getDataRange().getValues();
  const row = data.find(r => r[0] === 'schema_version');

  return row ? parseInt(row[1]) : 0;
}

/**
 * 최신 스키마로 초기화 (V7)
 */
function initializeSchema(spreadsheet) {
  // Data 시트 생성 및 헤더 설정
  const dataSheet = getOrCreateSheet(spreadsheet, 'Data');
  if (dataSheet.getLastRow() === 0) {
    dataSheet.appendRow([
      'id', 'date', 'amount', 'memo', 'method', 'category', 'created', 'updated'
    ]);
  }
  migrateDataSheetToV7(dataSheet);

  // Categories 시트 생성
  const categoriesSheet = getOrCreateSheet(spreadsheet, 'Categories');
  if (categoriesSheet.getLastRow() === 0) {
    categoriesSheet.appendRow(['code', 'name', 'type']);
    // 수입 카테고리
    categoriesSheet.appendRow(['income_salary', '급여', 'income']);
    categoriesSheet.appendRow(['income_other', '수입기타', 'income']);
    // 지출 카테고리
    categoriesSheet.appendRow(['expense_food', '식비', 'expense']);
    categoriesSheet.appendRow(['expense_transport', '교통/차량', 'expense']);
    categoriesSheet.appendRow(['expense_card', '카드결제', 'expense']);
    categoriesSheet.appendRow(['expense_saving', '저축', 'expense']);
    categoriesSheet.appendRow(['expense_housing', '주거/통신', 'expense']);
    categoriesSheet.appendRow(['expense_living', '생활용품', 'expense']);
    categoriesSheet.appendRow(['expense_clothing', '의복', 'expense']);
    categoriesSheet.appendRow(['expense_health', '건강/문화', 'expense']);
    categoriesSheet.appendRow(['expense_education', '교육/육아', 'expense']);
    categoriesSheet.appendRow(['expense_bills', '공과금', 'expense']);
    categoriesSheet.appendRow(['expense_events', '경조사', 'expense']);
    categoriesSheet.appendRow(['expense_allowance', '용돈', 'expense']);
    categoriesSheet.appendRow(['expense_interest', '이자', 'expense']);
  }

  // Methods 시트 생성 (결제수단)
  const methodsSheet = getOrCreateSheet(spreadsheet, 'Methods');
  if (methodsSheet.getLastRow() === 0) {
    methodsSheet.appendRow(['code', 'name']);
    methodsSheet.appendRow(['credit', '신용카드']);
    methodsSheet.appendRow(['debit', '체크카드']);
    methodsSheet.appendRow(['cash', '현금']);
    methodsSheet.appendRow(['transfer', '계좌이체']);
  }

  // 데이터 유효성 적용
  applyDataValidation(dataSheet, categoriesSheet, methodsSheet);
}

/**
 * Data 시트를 V7 스키마로 마이그레이션
 *
 * V6: id, date, amount, memo, method, category, created, email
 * V7: id, date, amount, memo, method, category, created, updated
 */
function migrateDataSheetToV7(dataSheet) {
  const headerRange = dataSheet.getRange(1, 1, 1, 8);
  const headers = headerRange.getValues()[0];
  const hadUpdatedColumn = headers[7] === 'updated';

  const expectedPrefix = ['id', 'date', 'amount', 'memo', 'method', 'category', 'created'];
  const isExpectedPrefix = expectedPrefix.every((name, index) => headers[index] === name);
  if (!isExpectedPrefix) {
    return;
  }

  if (headers[7] !== 'updated') {
    dataSheet.getRange(1, 8).setValue('updated');
  }

  const lastRow = dataSheet.getLastRow();
  if (lastRow <= 1) {
    return;
  }

  const createdValues = dataSheet.getRange(2, 7, lastRow - 1, 1).getValues();
  const updatedValues = hadUpdatedColumn
    ? dataSheet.getRange(2, 8, lastRow - 1, 1).getValues()
    : null;

  const nextUpdatedValues = createdValues.map((createdRow, index) => {
    const created = createdRow[0] || new Date().toISOString();
    if (!hadUpdatedColumn) {
      // V6(email) -> V7(updated) 전환 시에는 기존 8열(email) 값을 버리고 created로 백필
      return [created];
    }

    const updated = updatedValues ? updatedValues[index][0] : null;
    if (updated !== '' && updated !== null) {
      return [updated];
    }
    return [created];
  });

  dataSheet.getRange(2, 8, lastRow - 1, 1).setValues(nextUpdatedValues);
}

/**
 * 데이터 유효성 적용
 */
function applyDataValidation(dataSheet, categoriesSheet, methodsSheet) {
  // Data 시트의 category 컬럼(6열)에 데이터 유효성 적용
  const categoryRange = dataSheet.getRange(2, 6, dataSheet.getMaxRows() - 1, 1);
  const categoryValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(categoriesSheet.getRange(2, 2, categoriesSheet.getMaxRows() - 1, 1), true)
    .setAllowInvalid(false)
    .build();
  categoryRange.setDataValidation(categoryValidation);

  // Data 시트의 method 컬럼(5열)에 데이터 유효성 적용
  const methodRange = dataSheet.getRange(2, 5, dataSheet.getMaxRows() - 1, 1);
  const methodValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(methodsSheet.getRange(2, 2, methodsSheet.getMaxRows() - 1, 1), true)
    .setAllowInvalid(false)
    .build();
  methodRange.setDataValidation(methodValidation);
}

/**
 * 스키마 버전 설정
 */
function setSchemaVersion(metaSheet, version) {
  const data = metaSheet.getDataRange().getValues();

  if (metaSheet.getLastRow() === 0) {
    metaSheet.appendRow(['schema_version', version]);
    return;
  }

  const existingRowIndex = data.findIndex(r => r[0] === 'schema_version');

  if (existingRowIndex >= 0) {
    metaSheet.getRange(existingRowIndex + 1, 2).setValue(version);
  } else {
    metaSheet.appendRow(['schema_version', version]);
  }
}

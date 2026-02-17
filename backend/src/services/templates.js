const TEMPLATE_COLUMN_MAP = {
  id: 1,
  name: 2,
  type: 3,
  amount: 4,
  memo: 5,
  method: 6,
  category: 7,
  useCount: 8,
  lastUsedAt: 9,
  created: 10,
  updated: 11,
  sortOrder: 12,
};

const TEMPLATE_PAYMENT_METHODS = ['신용카드', '체크카드', '현금', '계좌이체'];
const INCOME_CATEGORIES = ['급여', '수입기타'];
const EXPENSE_CATEGORIES = [
  '식비',
  '교통/차량',
  '카드결제',
  '저축',
  '주거/통신',
  '생활용품',
  '의복',
  '건강/문화',
  '교육/육아',
  '공과금',
  '경조사',
  '용돈',
  '이자',
];

function getTemplatesSheet() {
  const spreadsheet = ensureSchema();
  return spreadsheet.getSheetByName('Templates');
}

function normalizeTemplateInput(input, options) {
  const { requireName } = options || {};
  const name = input.name !== undefined ? String(input.name).trim() : undefined;
  const type = input.type;
  const memo = input.memo !== undefined ? (input.memo ? String(input.memo).trim() : '') : undefined;
  const method = input.method !== undefined ? (input.method ? String(input.method).trim() : '') : undefined;
  const category = input.category !== undefined ? (input.category ? String(input.category).trim() : '') : undefined;

  let amount = input.amount;
  if (amount === '') amount = null;
  if (amount !== undefined && amount !== null) {
    amount = Number(amount);
    if (!Number.isFinite(amount)) {
      throw new Error('Invalid amount');
    }
  }

  if (requireName && (!name || name.length === 0)) {
    throw new Error('Missing required field: name');
  }

  if (type !== undefined && type !== 'income' && type !== 'expense') {
    throw new Error('Invalid type');
  }

  if (method !== undefined && method !== '' && TEMPLATE_PAYMENT_METHODS.indexOf(method) === -1) {
    throw new Error('Invalid payment method');
  }

  return {
    name,
    type,
    amount: amount === undefined ? undefined : amount,
    memo: memo === undefined ? undefined : memo,
    method: method === undefined ? undefined : method,
    category: category === undefined ? undefined : category,
  };
}

function ensureTemplateHasAtLeastOneField(template) {
  const hasAmount = template.amount !== null && template.amount !== undefined;
  const hasMemo = !!template.memo;
  const hasMethod = !!template.method;
  const hasCategory = !!template.category;

  if (!hasAmount && !hasMemo && !hasMethod && !hasCategory) {
    throw new Error('Template requires at least one value');
  }
}

function validateTemplateCategory(type, category) {
  if (!category) return;
  if (!type) throw new Error('Template type is required when category is set');

  const pool = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (pool.indexOf(category) === -1) {
    throw new Error('Invalid category for template type');
  }
}

function validateTemplateShape(template) {
  if (!template.type) {
    throw new Error('Missing required field: type');
  }

  if (template.amount !== null && template.amount !== undefined) {
    if (template.type === 'income' && template.amount < 0) {
      template.amount = Math.abs(template.amount);
    }
    if (template.type === 'expense' && template.amount > 0) {
      template.amount = -Math.abs(template.amount);
    }
  }

  validateTemplateCategory(template.type, template.category || '');
  ensureTemplateHasAtLeastOneField(template);
}

function mapTemplateRow(row) {
  return {
    id: row[0],
    name: row[1],
    type: row[2],
    amount: row[3] === '' || row[3] === null ? null : Number(row[3]),
    memo: row[4] || null,
    method: row[5] || null,
    category: row[6] || null,
    useCount: Number(row[7]) || 0,
    lastUsedAt: row[8] || null,
    created: row[9],
    updated: row[10] || row[9],
    sortOrder: Number(row[11]) || 0,
  };
}

function getTemplates() {
  const sheet = getTemplatesSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const templates = data.map(mapTemplateRow);

  templates.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.created.localeCompare(b.created);
  });

  return templates;
}

function createTemplate(input) {
  const sheet = getTemplatesSheet();
  const normalized = normalizeTemplateInput(input || {}, { requireName: true });
  validateTemplateShape(normalized);

  const now = new Date().toISOString();
  const lastRow = sheet.getLastRow();
  let nextSortOrder = 1;
  if (lastRow > 1) {
    const sortValues = sheet.getRange(2, TEMPLATE_COLUMN_MAP.sortOrder, lastRow - 1, 1).getValues();
    const maxSort = sortValues.reduce((max, row) => {
      const value = Number(row[0]);
      if (Number.isFinite(value) && value > max) return value;
      return max;
    }, 0);
    nextSortOrder = maxSort + 1;
  }
  const row = [
    generateUUID(),
    normalized.name,
    normalized.type,
    normalized.amount === null || normalized.amount === undefined ? '' : normalized.amount,
    normalized.memo || '',
    normalized.method || '',
    normalized.category || '',
    0,
    '',
    now,
    now,
    nextSortOrder,
  ];

  sheet.appendRow(row);
  SpreadsheetApp.flush();

  return mapTemplateRow(row);
}

function updateTemplate(id, updates) {
  const sheet = getTemplatesSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('No templates found');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const rowIndex = data.findIndex((row) => row[0] === id);
  if (rowIndex === -1) {
    throw new Error('Template not found');
  }

  const current = mapTemplateRow(data[rowIndex]);
  const normalized = normalizeTemplateInput(updates || {}, { requireName: false });
  const merged = {
    name: normalized.name !== undefined ? normalized.name : current.name,
    type: normalized.type !== undefined ? normalized.type : current.type,
    amount: normalized.amount !== undefined ? normalized.amount : current.amount,
    memo: normalized.memo !== undefined ? normalized.memo : current.memo,
    method: normalized.method !== undefined ? normalized.method : current.method,
    category: normalized.category !== undefined ? normalized.category : current.category,
  };

  if (!merged.name || merged.name.trim().length === 0) {
    throw new Error('Missing required field: name');
  }

  validateTemplateShape(merged);

  const rowNum = rowIndex + 2;
  const now = new Date().toISOString();
  const nextRow = [
    current.id,
    merged.name,
    merged.type,
    merged.amount === null || merged.amount === undefined ? '' : merged.amount,
    merged.memo || '',
    merged.method || '',
    merged.category || '',
    current.useCount || 0,
    current.lastUsedAt || '',
    current.created,
    now,
    current.sortOrder || (rowIndex + 1),
  ];

  sheet.getRange(rowNum, 1, 1, 12).setValues([nextRow]);
  SpreadsheetApp.flush();

  return mapTemplateRow(nextRow);
}

function deleteTemplate(id) {
  const sheet = getTemplatesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error('No templates found');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const rowIndex = data.findIndex((row) => row[0] === id);
  if (rowIndex === -1) {
    throw new Error('Template not found');
  }

  sheet.deleteRow(rowIndex + 2);
  SpreadsheetApp.flush();
  return { id: id };
}

function markTemplateUsed(id) {
  const sheet = getTemplatesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error('No templates found');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const rowIndex = data.findIndex((row) => row[0] === id);
  if (rowIndex === -1) {
    throw new Error('Template not found');
  }

  const rowNum = rowIndex + 2;
  const current = mapTemplateRow(data[rowIndex]);
  const now = new Date().toISOString();
  const nextUseCount = (current.useCount || 0) + 1;

  sheet.getRange(rowNum, TEMPLATE_COLUMN_MAP.useCount).setValue(nextUseCount);
  sheet.getRange(rowNum, TEMPLATE_COLUMN_MAP.lastUsedAt).setValue(now);
  sheet.getRange(rowNum, TEMPLATE_COLUMN_MAP.updated).setValue(now);
  SpreadsheetApp.flush();

  return {
    id: id,
    useCount: nextUseCount,
    lastUsedAt: now,
    updated: now,
  };
}

function reorderTemplates(ids) {
  const sheet = getTemplatesSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error('No templates found');
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Missing required field: ids');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  const rowById = {};
  data.forEach((row, index) => {
    rowById[row[0]] = index + 2;
  });

  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length !== ids.length) {
    throw new Error('Duplicate template id in ids');
  }

  uniqueIds.forEach((id) => {
    if (!rowById[id]) {
      throw new Error('Template not found: ' + id);
    }
  });

  const missingIds = data.map((row) => row[0]).filter((id) => uniqueIds.indexOf(id) === -1);
  const finalOrder = uniqueIds.concat(missingIds);

  const sortUpdates = finalOrder.map((id, index) => ({
    rowNum: rowById[id],
    sortOrder: index + 1,
  }));

  sortUpdates.forEach((item) => {
    sheet.getRange(item.rowNum, TEMPLATE_COLUMN_MAP.sortOrder).setValue(item.sortOrder);
  });
  SpreadsheetApp.flush();

  return { ids: finalOrder };
}

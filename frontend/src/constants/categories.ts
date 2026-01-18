export const INCOME_CATEGORIES = ['급여', '수입기타'] as const;

export const EXPENSE_CATEGORIES = [
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
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type Category = IncomeCategory | ExpenseCategory;

// 카테고리 단축이름 매핑
export const CATEGORY_MAP: Record<string, Category> = {
  // 수입
  '급': '급여',
  '수': '수입기타',

  // 지출
  '식': '식비',
  '교통': '교통/차량',
  '교육': '교육/육아',
  '카': '카드결제',
  '저': '저축',
  '주': '주거/통신',
  '생': '생활용품',
  '의': '의복',
  '건': '건강/문화',
  '공': '공과금',
  '경': '경조사',
  '용': '용돈',
  '이': '이자',
} as const;

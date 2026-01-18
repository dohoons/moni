export type PaymentMethod = '신용카드' | '체크카드' | '현금' | '계좌이체';

// 축약어 → 한국어 name 매핑
export const METHOD_MAP: Record<string, PaymentMethod> = {
  '신': '신용카드',
  '체': '체크카드',
  '현': '현금',
  '계': '계좌이체',
} as const;

import { METHOD_MAP, type PaymentMethod } from '../constants';
import { CATEGORY_MAP } from '../constants/categories';

export type ParsedInput = {
  amount: number;
  memo: string | null;
  method: PaymentMethod | null;
  category: string | null;
};

/**
 * Smart Entry Parser
 *
 * 입력 포맷: [금액] [내용메모?] [결제수단?] [분류?]
 *
 * 예시:
 * - "5000 커피 신" → { amount: -5000, memo: "커피", method: "credit", category: null }
 * - "+100000 월급" → { amount: 100000, memo: "월급", method: null, category: null }
 * - "3000" → { amount: -3000, memo: null, method: null, category: null }
 */
export function parseSmartEntry(input: string): ParsedInput {
  const tokens = input.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === '') {
    throw new Error('Empty input');
  }

  const result: ParsedInput = {
    amount: 0,
    memo: null,
    method: null,
    category: null,
  };

  // 1. 금액 파싱 (첫 번째 토큰)
  const amountToken = tokens[0];
  if (amountToken.startsWith('+')) {
    result.amount = parseInt(amountToken.slice(1)) || 0;
  } else if (amountToken.startsWith('-')) {
    result.amount = -(parseInt(amountToken.slice(1)) || 0);
  } else {
    result.amount = -(parseInt(amountToken) || 0); // 기본 지출
  }

  // 2. 나머지 토큰 처리
  for (const token of tokens.slice(1)) {
    if (METHOD_MAP[token]) {
      result.method = METHOD_MAP[token];
    } else if (!result.memo) {
      result.memo = token;
    } else if (!result.category) {
      // 단축이름을 실제 카테고리명으로 변환
      const mappedCategory = CATEGORY_MAP[token];
      if (mappedCategory) {
        result.category = mappedCategory;
      } else {
        // 유효하지 않은 카테고리는 메모에 추가
        result.memo = result.memo ? `${result.memo} ${token}` : token;
      }
    }
  }

  // 메모가 없는 지출은 기본값 "식비"
  if (!result.memo && result.amount < 0 && !result.category) {
    result.category = '식비';
  }

  // 금액만 입력된 빠른 지출은 기본 결제수단을 신용카드로 처리
  if (tokens.length === 1 && result.amount < 0 && !result.method) {
    result.method = '신용카드';
  }

  return result;
}

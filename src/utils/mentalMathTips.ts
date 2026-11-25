import { AttemptLog, ConcreteOperation, MathProblem } from '../types/math';

export interface WeakSpotInsight {
  attempt: AttemptLog;
  rankReason: 'missed' | 'slowest';
  tipTitle: string;
  tipDetail: string;
}

function parseExpressionOperands(
  expression: string
): { a: number; b: number; symbol: '+' | '−' | '×' | '÷' } | null {
  const match = /^\s*(-?\d+)\s*([+\-−×÷])\s*(-?\d+)\s*$/.exec(expression);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[3]);
  const rawSym = match[2];
  const symbol: '+' | '−' | '×' | '÷' =
    rawSym === '-' || rawSym === '−'
      ? '−'
      : rawSym === '×'
      ? '×'
      : rawSym === '÷'
      ? '÷'
      : '+';
  return { a, b, symbol };
}

export function generateMentalMathTip(attempt: AttemptLog): {
  title: string;
  detail: string;
} {
  const parsed = parseExpressionOperands(attempt.expression);
  if (!parsed) {
    return {
      title: 'Break into tens and ones',
      detail: 'Split multi-digit values into tens first, then combine ones.',
    };
  }

  const { a, b } = parsed;

  if (attempt.operation === 'addition') {
    const absB = Math.abs(b);
    const mod10B = absB % 10;
    if (mod10B >= 7 && absB >= 10) {
      const roundUp = Math.ceil(absB / 10) * 10;
      const diff = roundUp - absB;
      return {
        title: 'Round up & adjust',
        detail: `Add ${roundUp} first (${a} + ${roundUp} = ${a + roundUp}), then subtract ${diff} → ${attempt.expected}.`,
      };
    }
    if (a >= 10 && b >= 10) {
      const tensA = Math.floor(a / 10) * 10;
      const onesA = a % 10;
      const tensB = Math.floor(b / 10) * 10;
      const onesB = b % 10;
      return {
        title: 'Left-to-right place values',
        detail: `Add tens (${tensA} + ${tensB} = ${tensA + tensB}) and ones (${onesA} + ${onesB} = ${onesA + onesB}), then total ${attempt.expected}.`,
      };
    }
    const toTen = 10 - (a % 10);
    if (toTen > 0 && toTen < b) {
      return {
        title: 'Bridge through 10',
        detail: `Make the next ten first (${a} + ${toTen} = ${a + toTen}), then add the remaining ${b - toTen} → ${attempt.expected}.`,
      };
    }
    return {
      title: 'Start from the larger number',
      detail: `Anchor on ${Math.max(a, b)} and count/add ${Math.min(a, b)} cleanly → ${attempt.expected}.`,
    };
  }

  if (attempt.operation === 'subtraction') {
    if (b >= 10 && b % 10 >= 7) {
      const roundUp = Math.ceil(b / 10) * 10;
      const diff = roundUp - b;
      return {
        title: 'Subtract friendly ten & add back',
        detail: `Subtract ${roundUp} (${a} − ${roundUp} = ${a - roundUp}), then add back ${diff} → ${attempt.expected}.`,
      };
    }
    if (a > b && Math.floor(a / 10) !== Math.floor(b / 10) && b >= 10) {
      const tensB = Math.floor(b / 10) * 10;
      const onesB = b % 10;
      return {
        title: 'Subtract tens, then ones',
        detail: `${a} − ${tensB} = ${a - tensB}, then subtract ${onesB} → ${attempt.expected}.`,
      };
    }
    return {
      title: 'Count up from the smaller number',
      detail: `Think: what must you add to ${b} to reach ${a}? Difference is ${attempt.expected}.`,
    };
  }

  if (attempt.operation === 'multiplication') {
    if (b === 5 || a === 5) {
      const other = a === 5 ? b : a;
      return {
        title: 'Multiply by 10, halve it',
        detail: `Take ${other} × 10 = ${other * 10}, then divide by 2 → ${attempt.expected}.`,
      };
    }
    if (b === 9 || a === 9) {
      const other = a === 9 ? b : a;
      return {
        title: '×10 minus the number',
        detail: `Compute ${other} × 10 = ${other * 10}, then subtract ${other} → ${attempt.expected}.`,
      };
    }
    if (a >= 11 || b >= 11) {
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      const tens = Math.floor(big / 10) * 10;
      const ones = big % 10;
      return {
        title: 'Split tens and ones',
        detail: `Do (${tens} × ${small} = ${tens * small}) + (${ones} × ${small} = ${ones * small}) = ${attempt.expected}.`,
      };
    }
    if (a % 2 === 0 && b > 2) {
      return {
        title: 'Double & halve trick',
        detail: `Halve ${a} to ${a / 2} and double ${b} to ${b * 2}: ${a / 2} × ${b * 2} = ${attempt.expected}.`,
      };
    }
    return {
      title: 'Anchor to nearest known fact',
      detail: `Use a nearby table fact like ${a} × ${Math.max(1, b - 1)} + ${a} to lock in ${attempt.expected}.`,
    };
  }

  // Division
  if (b === 5) {
    return {
      title: 'Double dividend, divide by 10',
      detail: `Double ${a} to ${a * 2}, then drop the trailing zero → ${attempt.expected}.`,
    };
  }
  const halfExpected = Math.floor(attempt.expected / 10) * 10;
  if (attempt.expected >= 12 && halfExpected >= 10) {
    return {
      title: 'Chunk by 10× divisor',
      detail: `Pull out ${b} × ${halfExpected} = ${b * halfExpected}, leaving ${a - b * halfExpected} ÷ ${b} = ${attempt.expected - halfExpected}.`,
    };
  }
  return {
    title: 'Flip to multiplication',
    detail: `Ask "${b} × ? = ${a}". Since ${b} × ${attempt.expected} = ${a}, answer is ${attempt.expected}.`,
  };
}

/**
 * Selects the top 3 slowest or missed problems from a round (missed prioritized, then slowest).
 */
export function selectTopWeakSpotInsights(
  attempts: AttemptLog[],
  maxCount = 3
): WeakSpotInsight[] {
  if (attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => {
    const aMissed = a.outcome !== 'correct' ? 1 : 0;
    const bMissed = b.outcome !== 'correct' ? 1 : 0;
    if (aMissed !== bMissed) return bMissed - aMissed;
    return b.responseMs - a.responseMs;
  });

  // Deduplicate by expression so tips are varied
  const seen = new Set<string>();
  const picked: WeakSpotInsight[] = [];
  for (const item of sorted) {
    if (seen.has(item.expression)) continue;
    seen.add(item.expression);
    const tip = generateMentalMathTip(item);
    picked.push({
      attempt: item,
      rankReason: item.outcome !== 'correct' ? 'missed' : 'slowest',
      tipTitle: tip.title,
      tipDetail: tip.detail,
    });
    if (picked.length >= maxCount) break;
  }
  return picked;
}

function clampRand(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function buildTargetedVariant(
  op: ConcreteOperation,
  a: number,
  b: number,
  allowNegatives: boolean,
  index: number
): MathProblem {
  const jitterA = clampRand(-3, 4);
  const jitterB = clampRand(-2, 3);

  if (op === 'addition') {
    const nextA = Math.max(1, a + jitterA);
    const nextB = Math.max(1, b + jitterB);
    return {
      id: `ws_${Date.now()}_${index}`,
      operandA: nextA,
      operandB: nextB,
      operation: 'addition',
      symbol: '+',
      answer: nextA + nextB,
      signature: `+:${nextA}:${nextB}`,
      presentedAt: performance.now(),
    };
  }

  if (op === 'subtraction') {
    let nextA = Math.max(2, a + jitterA);
    let nextB = Math.max(1, b + jitterB);
    if (!allowNegatives && nextA < nextB) {
      [nextA, nextB] = [nextB + clampRand(1, 5), nextA];
    }
    return {
      id: `ws_${Date.now()}_${index}`,
      operandA: nextA,
      operandB: nextB,
      operation: 'subtraction',
      symbol: '−',
      answer: nextA - nextB,
      signature: `-:${nextA}:${nextB}`,
      presentedAt: performance.now(),
    };
  }

  if (op === 'multiplication') {
    const nextA = Math.max(2, a + clampRand(-2, 2));
    const nextB = Math.max(2, b + clampRand(-1, 2));
    return {
      id: `ws_${Date.now()}_${index}`,
      operandA: nextA,
      operandB: nextB,
      operation: 'multiplication',
      symbol: '×',
      answer: nextA * nextB,
      signature: `*:${nextA}:${nextB}`,
      presentedAt: performance.now(),
    };
  }

  // Division: keep exact integer division near the missed/slow problem's scale
  const approxQuotient = b !== 0 ? Math.max(2, Math.round(a / b)) : 4;
  const divisor = Math.max(2, b + clampRand(-1, 2));
  const quotient = Math.max(2, approxQuotient + clampRand(-2, 2));
  const dividend = divisor * quotient;
  return {
    id: `ws_${Date.now()}_${index}`,
    operandA: dividend,
    operandB: divisor,
    operation: 'division',
    symbol: '÷',
    answer: quotient,
    signature: `/:${dividend}:${divisor}`,
    presentedAt: performance.now(),
  };
}

/**
 * Generates an adaptive 5-question drill queue targeting the learner's
 * missed and slowest problems from the completed round.
 */
export function buildAdaptiveWeakSpotQueue(
  attempts: AttemptLog[],
  allowNegatives: boolean,
  count = 5
): MathProblem[] {
  const insights = selectTopWeakSpotInsights(attempts, 3);
  if (insights.length === 0) return [];

  const queue: MathProblem[] = [];
  const usedSignatures = new Set<string>();

  for (let i = 0; i < count; i++) {
    const seedInsight = insights[i % insights.length];
    const parsed = parseExpressionOperands(seedInsight.attempt.expression);
    const baseA = parsed?.a ?? 12;
    const baseB = parsed?.b ?? 7;

    let candidate = buildTargetedVariant(
      seedInsight.attempt.operation,
      baseA,
      baseB,
      allowNegatives,
      i + 1
    );

    for (let retry = 0; retry < 6; retry++) {
      if (!usedSignatures.has(candidate.signature)) break;
      candidate = buildTargetedVariant(
        seedInsight.attempt.operation,
        baseA,
        baseB,
        allowNegatives,
        i + 1
      );
    }

    usedSignatures.add(candidate.signature);
    queue.push(candidate);
  }

  return queue;
}

import {
  ArithmeticMode,
  ConcreteOperation,
  Difficulty,
  INDIAN_CLASS_META,
  IndianClass,
  MathProblem,
} from '../types/math';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface ClassNumberRanges {
  add: [number, number];
  sub: [number, number];
  mulA: [number, number];
  mulB: [number, number];
  divDivisor: [number, number];
  divQuotient: [number, number];
}

const CLASS_RANGES: Record<IndianClass, ClassNumberRanges> = {
  Nursery: {
    add: [1, 5],
    sub: [1, 5],
    mulA: [1, 2],
    mulB: [1, 2],
    divDivisor: [1, 2],
    divQuotient: [1, 2],
  },
  LKG: {
    add: [1, 9],
    sub: [1, 9],
    mulA: [1, 3],
    mulB: [1, 3],
    divDivisor: [1, 3],
    divQuotient: [1, 3],
  },
  UKG: {
    add: [1, 15],
    sub: [2, 15],
    mulA: [2, 4],
    mulB: [2, 4],
    divDivisor: [2, 4],
    divQuotient: [2, 4],
  },
  '1st': {
    add: [1, 20],
    sub: [2, 20],
    mulA: [2, 5],
    mulB: [2, 5],
    divDivisor: [2, 5],
    divQuotient: [2, 5],
  },
  '2nd': {
    add: [2, 50],
    sub: [5, 50],
    mulA: [2, 5],
    mulB: [2, 9],
    divDivisor: [2, 5],
    divQuotient: [2, 9],
  },
  '3rd': {
    add: [5, 99],
    sub: [8, 99],
    mulA: [2, 9],
    mulB: [2, 9],
    divDivisor: [2, 9],
    divQuotient: [2, 9],
  },
  '4th': {
    add: [10, 150],
    sub: [12, 150],
    mulA: [2, 12],
    mulB: [2, 12],
    divDivisor: [2, 12],
    divQuotient: [2, 12],
  },
  '5th': {
    add: [15, 250],
    sub: [15, 250],
    mulA: [3, 15],
    mulB: [2, 12],
    divDivisor: [2, 12],
    divQuotient: [3, 15],
  },
  '6th': {
    add: [20, 300],
    sub: [20, 300],
    mulA: [3, 18],
    mulB: [2, 12],
    divDivisor: [2, 14],
    divQuotient: [3, 18],
  },
  '7th': {
    add: [25, 400],
    sub: [25, 400],
    mulA: [4, 20],
    mulB: [3, 15],
    divDivisor: [3, 15],
    divQuotient: [4, 20],
  },
  '8th': {
    add: [30, 500],
    sub: [30, 500],
    mulA: [5, 25],
    mulB: [3, 15],
    divDivisor: [3, 16],
    divQuotient: [5, 25],
  },
  '9th': {
    add: [40, 650],
    sub: [40, 650],
    mulA: [6, 25],
    mulB: [4, 19],
    divDivisor: [3, 19],
    divQuotient: [6, 25],
  },
  '10th': {
    add: [50, 750],
    sub: [50, 750],
    mulA: [6, 29],
    mulB: [4, 19],
    divDivisor: [4, 19],
    divQuotient: [6, 29],
  },
  '11th': {
    add: [75, 999],
    sub: [75, 999],
    mulA: [8, 35],
    mulB: [5, 20],
    divDivisor: [4, 20],
    divQuotient: [8, 35],
  },
  '12th': {
    add: [99, 1200],
    sub: [99, 1200],
    mulA: [9, 45],
    mulB: [6, 25],
    divDivisor: [5, 25],
    divQuotient: [9, 45],
  },
};

function pickOperation(
  mode: ArithmeticMode,
  indianClass?: IndianClass
): ConcreteOperation {
  const allowedOps: ConcreteOperation[] = indianClass
    ? INDIAN_CLASS_META[indianClass].allowedOperations
    : ['addition', 'subtraction', 'multiplication', 'division'];

  if (mode !== 'mixed' && allowedOps.includes(mode)) {
    return mode;
  }
  return allowedOps[Math.floor(Math.random() * allowedOps.length)];
}

function resolveRanges(
  difficulty: Difficulty,
  indianClass?: IndianClass
): ClassNumberRanges {
  if (indianClass) {
    return CLASS_RANGES[indianClass];
  }
  if (difficulty === 'easy') return CLASS_RANGES['3rd'];
  if (difficulty === 'medium') return CLASS_RANGES['5th'];
  return CLASS_RANGES['10th'];
}

function buildSingleProblem(
  operation: ConcreteOperation,
  difficulty: Difficulty,
  allowNegatives: boolean,
  indianClass?: IndianClass
): Omit<MathProblem, 'id' | 'presentedAt'> {
  const ranges = resolveRanges(difficulty, indianClass);
  const negativesEnabled =
    allowNegatives &&
    (!indianClass || INDIAN_CLASS_META[indianClass].allowNegativesAvailable);

  if (operation === 'addition') {
    const [min, max] = ranges.add;
    const operandA = randInt(min, max);
    const operandB = randInt(min, max);
    return {
      operandA,
      operandB,
      operation,
      symbol: '+',
      answer: operandA + operandB,
      signature: `+:${operandA}:${operandB}`,
    };
  }

  if (operation === 'subtraction') {
    const [min, max] = ranges.sub;
    let operandA = randInt(min, max);
    let operandB = randInt(min, max);

    if (!negativesEnabled && operandA < operandB) {
      [operandA, operandB] = [operandB, operandA];
    }

    // Avoid overly trivial x - x = 0 repeats on higher classes
    if (
      operandA === operandB &&
      indianClass !== 'Nursery' &&
      indianClass !== 'LKG' &&
      indianClass !== 'UKG' &&
      difficulty !== 'easy'
    ) {
      operandA += randInt(1, 9);
    }

    return {
      operandA,
      operandB,
      operation,
      symbol: '−',
      answer: operandA - operandB,
      signature: `-:${operandA}:${operandB}`,
    };
  }

  if (operation === 'multiplication') {
    let operandA = randInt(ranges.mulA[0], ranges.mulA[1]);
    let operandB = randInt(ranges.mulB[0], ranges.mulB[1]);

    if (Math.random() < 0.5) {
      [operandA, operandB] = [operandB, operandA];
    }

    return {
      operandA,
      operandB,
      operation,
      symbol: '×',
      answer: operandA * operandB,
      signature: `*:${operandA}:${operandB}`,
    };
  }

  // Division: exact integer factors only (quotient * divisor) ÷ divisor = quotient
  const divisor = randInt(ranges.divDivisor[0], ranges.divDivisor[1]);
  const quotient = randInt(ranges.divQuotient[0], ranges.divQuotient[1]);
  const dividend = divisor * quotient;

  return {
    operandA: dividend,
    operandB: divisor,
    operation: 'division',
    symbol: '÷',
    answer: quotient,
    signature: `/:${dividend}:${divisor}`,
  };
}

let problemCounter = 0;

/**
 * Generates a clean, solvable mental arithmetic problem tailored to Indian school class,
 * arithmetic mode, and difficulty. Guarantees exact integer division and no consecutive repeats.
 */
export function generateProblem(
  mode: ArithmeticMode,
  difficulty: Difficulty,
  allowNegatives: boolean,
  previousSignature?: string,
  indianClass?: IndianClass
): MathProblem {
  let candidate = buildSingleProblem(
    pickOperation(mode, indianClass),
    difficulty,
    allowNegatives,
    indianClass
  );

  for (let attempt = 0; attempt < 8; attempt++) {
    if (candidate.signature !== previousSignature) {
      break;
    }
    candidate = buildSingleProblem(
      pickOperation(mode, indianClass),
      difficulty,
      allowNegatives,
      indianClass
    );
  }

  problemCounter += 1;
  return {
    ...candidate,
    id: `p_${Date.now()}_${problemCounter}`,
    presentedAt: performance.now(),
  };
}

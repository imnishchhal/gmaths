import {
  ArithmeticMode,
  ConcreteOperation,
  Difficulty,
  MathProblem,
} from '../types/math';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOperation(mode: ArithmeticMode): ConcreteOperation {
  if (mode !== 'mixed') {
    return mode;
  }
  const ops: ConcreteOperation[] = [
    'addition',
    'subtraction',
    'multiplication',
    'division',
  ];
  return ops[Math.floor(Math.random() * ops.length)];
}

function buildSingleProblem(
  operation: ConcreteOperation,
  difficulty: Difficulty,
  allowNegatives: boolean
): Omit<MathProblem, 'id' | 'presentedAt'> {
  if (operation === 'addition') {
    const [min, max] =
      difficulty === 'easy'
        ? [1, 20]
        : difficulty === 'medium'
        ? [10, 99]
        : [25, 499];
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
    const [min, max] =
      difficulty === 'easy'
        ? [2, 20]
        : difficulty === 'medium'
        ? [10, 99]
        : [25, 499];
    let operandA = randInt(min, max);
    let operandB = randInt(min, max);

    if (!allowNegatives && operandA < operandB) {
      [operandA, operandB] = [operandB, operandA];
    }

    // Avoid overly trivial x - x = 0 repeats on harder levels
    if (operandA === operandB && difficulty !== 'easy') {
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
    let operandA: number;
    let operandB: number;

    if (difficulty === 'easy') {
      operandA = randInt(2, 9);
      operandB = randInt(2, 9);
    } else if (difficulty === 'medium') {
      operandA = randInt(3, 15);
      operandB = randInt(2, 12);
      if (Math.random() < 0.35) {
        operandA = randInt(12, 25);
        operandB = randInt(3, 9);
      }
    } else {
      operandA = randInt(6, 29);
      operandB = randInt(4, 19);
    }

    // Randomly swap operand order for variety
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

  // Division: always constructed from exact integer factors (quotient * divisor) ÷ divisor = quotient
  let divisor: number;
  let quotient: number;

  if (difficulty === 'easy') {
    divisor = randInt(2, 9);
    quotient = randInt(2, 9);
  } else if (difficulty === 'medium') {
    divisor = randInt(2, 12);
    quotient = randInt(3, 15);
  } else {
    divisor = randInt(3, 19);
    quotient = randInt(6, 29);
  }

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
 * Generates a clean, solvable mental arithmetic problem tailored to mode and difficulty.
 * Guarantees no consecutive identical problems and exact integer division.
 */
export function generateProblem(
  mode: ArithmeticMode,
  difficulty: Difficulty,
  allowNegatives: boolean,
  previousSignature?: string
): MathProblem {
  let candidate = buildSingleProblem(pickOperation(mode), difficulty, allowNegatives);

  // Retry up to 8 times to prevent immediate repeats
  for (let attempt = 0; attempt < 8; attempt++) {
    if (candidate.signature !== previousSignature) {
      break;
    }
    candidate = buildSingleProblem(pickOperation(mode), difficulty, allowNegatives);
  }

  problemCounter += 1;
  return {
    ...candidate,
    id: `p_${Date.now()}_${problemCounter}`,
    presentedAt: performance.now(),
  };
}

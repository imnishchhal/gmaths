import React from 'react';
import { CornerDownLeft, Delete, SkipForward } from 'lucide-react';

interface NumericKeypadProps {
  allowNegatives: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onToggleSign: () => void;
  onSubmit: () => void;
  onSkip: () => void;
  disabled?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  allowNegatives,
  onDigit,
  onBackspace,
  onClear,
  onToggleSign,
  onSubmit,
  onSkip,
  disabled = false,
}) => {
  const trigger =
    (handler: () => void) => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!disabled) {
        handler();
      }
    };

  const digitClass =
    'min-h-[54px] sm:min-h-[60px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/90 active:scale-[0.96] active:bg-slate-100 dark:active:bg-slate-800 text-slate-900 dark:text-white font-mono text-2xl font-semibold tabular-nums flex items-center justify-center select-none touch-manipulation transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600';

  const utilityClass =
    'min-h-[54px] sm:min-h-[60px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 active:scale-[0.96] text-slate-700 dark:text-slate-200 font-semibold text-base flex items-center justify-center gap-1.5 select-none touch-manipulation transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600';

  return (
    <div
      role="group"
      aria-label="Numeric keypad"
      className="w-full max-w-md mx-auto grid grid-cols-4 gap-2 sm:gap-2.5 select-none"
    >
      {/* Row 1: 7 8 9 Backspace */}
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('7'))}
        className={digitClass}
        aria-label="7"
      >
        7
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('8'))}
        className={digitClass}
        aria-label="8"
      >
        8
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('9'))}
        className={digitClass}
        aria-label="9"
      >
        9
      </button>
      <button
        type="button"
        onPointerDown={trigger(onBackspace)}
        className={utilityClass}
        aria-label="Backspace"
      >
        <Delete className="w-5 h-5" />
      </button>

      {/* Row 2: 4 5 6 Clear */}
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('4'))}
        className={digitClass}
        aria-label="4"
      >
        4
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('5'))}
        className={digitClass}
        aria-label="5"
      >
        5
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('6'))}
        className={digitClass}
        aria-label="6"
      >
        6
      </button>
      <button
        type="button"
        onPointerDown={trigger(onClear)}
        className={utilityClass}
        aria-label="Clear input"
      >
        <span className="font-mono text-lg">C</span>
      </button>

      {/* Row 3: 1 2 3 + Tall Submit */}
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('1'))}
        className={digitClass}
        aria-label="1"
      >
        1
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('2'))}
        className={digitClass}
        aria-label="2"
      >
        2
      </button>
      <button
        type="button"
        onPointerDown={trigger(() => onDigit('3'))}
        className={digitClass}
        aria-label="3"
      >
        3
      </button>
      <button
        type="button"
        onPointerDown={trigger(onSubmit)}
        className="row-span-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.97] active:bg-blue-800 text-white font-semibold flex flex-col items-center justify-center gap-1 select-none touch-manipulation transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        aria-label="Submit answer"
      >
        <CornerDownLeft className="w-6 h-6" />
        <span className="text-xs font-semibold tracking-tight whitespace-nowrap">
          Go
        </span>
      </button>

      {/* Row 4: [±, 0, Skip] or [0 (wide), Skip] */}
      {allowNegatives ? (
        <>
          <button
            type="button"
            onPointerDown={trigger(onToggleSign)}
            className={utilityClass}
            aria-label="Toggle positive or negative sign"
          >
            <span className="font-mono text-xl">±</span>
          </button>
          <button
            type="button"
            onPointerDown={trigger(() => onDigit('0'))}
            className={digitClass}
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            onPointerDown={trigger(onSkip)}
            className={utilityClass}
            aria-label="Skip problem"
          >
            <SkipForward className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap">Skip</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={trigger(() => onDigit('0'))}
            className={`col-span-2 ${digitClass}`}
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            onPointerDown={trigger(onSkip)}
            className={utilityClass}
            aria-label="Skip problem"
          >
            <SkipForward className="w-4 h-4" />
            <span className="text-xs whitespace-nowrap">Skip</span>
          </button>
        </>
      )}
    </div>
  );
};

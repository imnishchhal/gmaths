import React, { useRef } from 'react';
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
  const lastPointerMsRef = useRef<number>(0);

  const bindKey = (handler: () => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      lastPointerMsRef.current = Date.now();
      if (!disabled) {
        handler();
      }
    },
    onClick: () => {
      if (Date.now() - lastPointerMsRef.current < 450) {
        return;
      }
      if (!disabled) {
        handler();
      }
    },
  });

  // Tactile 3D toy-block keys (>= 48px touch targets) that press down satisfyingly on tap
  const digitClass =
    'min-h-[50px] sm:min-h-[58px] rounded-2xl border-2 border-b-4 border-sky-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700/90 active:border-b-2 active:translate-y-[2px] active:bg-sky-100 dark:active:bg-slate-700 text-slate-900 dark:text-white font-display text-2xl sm:text-3xl font-bold tabular-nums flex items-center justify-center select-none touch-manipulation transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

  const backspaceClass =
    'min-h-[50px] sm:min-h-[58px] rounded-2xl border-2 border-b-4 border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:border-b-2 active:translate-y-[2px] text-rose-700 dark:text-rose-300 font-bold text-sm sm:text-base flex items-center justify-center gap-1 select-none touch-manipulation transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500';

  const clearClass =
    'min-h-[50px] sm:min-h-[58px] rounded-2xl border-2 border-b-4 border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:border-b-2 active:translate-y-[2px] text-amber-800 dark:text-amber-300 font-bold text-sm sm:text-base flex items-center justify-center gap-1 select-none touch-manipulation transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';

  const utilityClass =
    'min-h-[50px] sm:min-h-[58px] rounded-2xl border-2 border-b-4 border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 active:border-b-2 active:translate-y-[2px] text-sky-800 dark:text-sky-300 font-bold text-sm sm:text-base flex items-center justify-center gap-1 select-none touch-manipulation transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

  return (
    <div
      role="group"
      aria-label="Onscreen numeric keypad"
      className="w-full max-w-md mx-auto grid grid-cols-4 gap-2 sm:gap-2.5 select-none"
    >
      {/* Row 1: 7 8 9 Backspace */}
      <button
        type="button"
        {...bindKey(() => onDigit('7'))}
        className={digitClass}
        aria-label="7"
      >
        7
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('8'))}
        className={digitClass}
        aria-label="8"
      >
        8
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('9'))}
        className={digitClass}
        aria-label="9"
      >
        9
      </button>
      <button
        type="button"
        {...bindKey(onBackspace)}
        className={backspaceClass}
        aria-label="Backspace"
      >
        <Delete className="w-5 h-5" />
      </button>

      {/* Row 2: 4 5 6 Clear */}
      <button
        type="button"
        {...bindKey(() => onDigit('4'))}
        className={digitClass}
        aria-label="4"
      >
        4
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('5'))}
        className={digitClass}
        aria-label="5"
      >
        5
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('6'))}
        className={digitClass}
        aria-label="6"
      >
        6
      </button>
      <button
        type="button"
        {...bindKey(onClear)}
        className={clearClass}
        aria-label="Clear input"
      >
        <span className="font-display text-lg sm:text-xl">C</span>
      </button>

      {/* Row 3: 1 2 3 + Tall Submit */}
      <button
        type="button"
        {...bindKey(() => onDigit('1'))}
        className={digitClass}
        aria-label="1"
      >
        1
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('2'))}
        className={digitClass}
        aria-label="2"
      >
        2
      </button>
      <button
        type="button"
        {...bindKey(() => onDigit('3'))}
        className={digitClass}
        aria-label="3"
      >
        3
      </button>
      <button
        type="button"
        {...bindKey(onSubmit)}
        className="row-span-2 min-h-[50px] rounded-2xl bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-600 border-b-4 border-b-emerald-700 active:border-b-2 active:translate-y-[2px] active:bg-emerald-600 text-white font-display font-bold flex flex-col items-center justify-center gap-0.5 select-none touch-manipulation transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        aria-label="Submit answer"
      >
        <CornerDownLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="text-sm font-bold tracking-tight whitespace-nowrap">
          Go!
        </span>
      </button>

      {/* Row 4: [±, 0, Skip] or [0 (wide), Skip] */}
      {allowNegatives ? (
        <>
          <button
            type="button"
            {...bindKey(onToggleSign)}
            className={utilityClass}
            aria-label="Toggle positive or negative sign"
          >
            <span className="font-display text-xl sm:text-2xl">±</span>
          </button>
          <button
            type="button"
            {...bindKey(() => onDigit('0'))}
            className={digitClass}
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            {...bindKey(onSkip)}
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
            {...bindKey(() => onDigit('0'))}
            className={`col-span-2 ${digitClass}`}
            aria-label="0"
          >
            0
          </button>
          <button
            type="button"
            {...bindKey(onSkip)}
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

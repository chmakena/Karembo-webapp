import clsx from "clsx";

import { Check } from "../icons";

export const BOOKING_STEPS = ["Service", "Stylist", "Date & time", "Confirm"] as const;

/**
 * Booking progress.
 *
 * Rendered as an ordered list with `aria-current="step"`, and completed steps
 * carry a tick as well as a colour change — so progress is legible without
 * relying on hue.
 */
export function Stepper({
  current,
  onStepClick,
}: {
  /** 1-based. */
  current: number;
  /** Allows jumping back to an already-completed step. */
  onStepClick?: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {BOOKING_STEPS.map((label, index) => {
        const step = index + 1;
        const isDone = step < current;
        const isCurrent = step === current;
        const clickable = isDone && onStepClick;

        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick(step) : undefined}
              aria-current={isCurrent ? "step" : undefined}
              className={clsx(
                "flex items-center gap-2 rounded-full text-sm transition-colors",
                clickable && "cursor-pointer hover:text-plum-700",
                isCurrent
                  ? "font-semibold text-plum-700"
                  : isDone
                    ? "text-sand-700"
                    : "text-sand-500",
              )}
            >
              <span
                className={clsx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold numeric",
                  isCurrent
                    ? "border-plum-600 bg-plum-600 text-white"
                    : isDone
                      ? "border-plum-200 bg-plum-100 text-plum-700"
                      : "border-sand-300 bg-white",
                )}
              >
                {isDone ? <Check className="size-3.5" /> : step}
              </span>
              <span className="whitespace-nowrap">{label}</span>
            </button>
            {step < BOOKING_STEPS.length && (
              <span aria-hidden className="hidden h-px w-8 bg-sand-300 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

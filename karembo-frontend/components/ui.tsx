/**
 * The shared UI primitives, implementing the components specified in
 * `design/screens/01-foundations.html`.
 *
 * These are presentational and mostly server-safe; only the ones that need
 * state carry "use client" in their own files.
 */

import clsx from "clsx";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import type { BookingStatus } from "@/lib/types";

// --------------------------------------------------------------------------
// Button
// --------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "tracking-wide whitespace-nowrap transition-all duration-200 " +
  "active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed " +
  "disabled:active:translate-y-0 cursor-pointer";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-plum-600 text-white shadow-sm hover:bg-plum-700 hover:shadow-md " +
    "disabled:hover:bg-plum-600",
  secondary:
    "bg-white text-plum-700 border border-sand-300 hover:bg-plum-50 " +
    "hover:border-plum-300",
  ghost: "bg-transparent text-sand-600 hover:bg-sand-100 hover:text-sand-900",
  danger:
    "bg-white text-danger-600 border border-danger-200 hover:bg-danger-50 " +
    "hover:border-danger-600",
};

// Every size clears the 44px tap target except `sm`, which is reserved for
// dense admin tables where a pointer is the expected input.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-2xs",
  md: "min-h-11 px-6 text-sm",
  lg: "min-h-13 px-8 text-base",
};

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  block?: boolean,
  className?: string,
) {
  return clsx(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    block && "w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <button
      className={buttonClass(variant, size, block, className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}) {
  return (
    <Link className={buttonClass(variant, size, block, className)} {...props} />
  );
}

// --------------------------------------------------------------------------
// Card
// --------------------------------------------------------------------------

export function Card({
  as: Tag = "div",
  className,
  children,
  ...props
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag
      className={clsx(
        "rounded-lg border border-sand-200 bg-white p-6 shadow-xs",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

// --------------------------------------------------------------------------
// Badge
// --------------------------------------------------------------------------

type BadgeTone =
  | "neutral"
  | "brand"
  | "gold"
  | "success"
  | "warning"
  | "danger"
  | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-sand-100 text-sand-700 border-sand-200",
  brand: "bg-plum-50 text-plum-700 border-plum-200",
  gold: "bg-gold-50 text-gold-700 border-gold-200",
  success: "bg-success-50 text-success-700 border-success-200",
  warning: "bg-warning-50 text-warning-700 border-warning-200",
  danger: "bg-danger-50 text-danger-700 border-danger-200",
  info: "bg-info-50 text-info-700 border-info-200",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Adds a leading dot so status does not rest on hue alone. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-0.5",
        "text-2xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}

/** Booking status is shown identically everywhere it appears. */
const STATUS_PRESENTATION: Record<BookingStatus, { tone: BadgeTone; label: string }> =
  {
    pending: { tone: "warning", label: "Pending" },
    confirmed: { tone: "success", label: "Confirmed" },
    completed: { tone: "info", label: "Completed" },
    cancelled: { tone: "danger", label: "Cancelled" },
    no_show: { tone: "neutral", label: "No show" },
  };

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { tone, label } = STATUS_PRESENTATION[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

// --------------------------------------------------------------------------
// Alert
// --------------------------------------------------------------------------

const ALERT_TONES = {
  info: "bg-info-50 border-info-200 text-info-700",
  success: "bg-success-50 border-success-200 text-success-700",
  warning: "bg-warning-50 border-warning-200 text-warning-700",
  danger: "bg-danger-50 border-danger-200 text-danger-700",
} as const;

export function Alert({
  tone = "info",
  icon,
  className,
  children,
}: {
  tone?: keyof typeof ALERT_TONES;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "flex gap-3 rounded-md border p-4 text-sm",
        ALERT_TONES[tone],
        className,
      )}
      // Errors and warnings should reach a screen reader when they appear.
      role={tone === "danger" ? "alert" : undefined}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Form controls
// --------------------------------------------------------------------------

const CONTROL_BASE =
  "w-full min-h-11 rounded-md border bg-white px-4 py-3 text-base " +
  "text-sand-900 placeholder:text-sand-500 transition-colors " +
  "focus:outline-none focus:border-plum-600 focus:ring-3 focus:ring-plum-100";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-sand-800"
      >
        {label}
        {required && (
          <span className="ml-1 text-danger-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {/* An error replaces the hint rather than stacking with it. */}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-danger-600"
        >
          <AlertIcon className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-2 text-xs text-sand-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  invalid,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={clsx(
        CONTROL_BASE,
        invalid
          ? "border-danger-600 focus:border-danger-600 focus:ring-danger-200"
          : "border-sand-300",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={clsx(
        CONTROL_BASE,
        "min-h-24 resize-y leading-relaxed",
        invalid ? "border-danger-600" : "border-sand-300",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={clsx(
        CONTROL_BASE,
        "cursor-pointer appearance-none border-sand-300 bg-no-repeat pr-10",
        className,
      )}
      style={{
        // Chevron as a data URI keeps this dependency-free.
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23665c58' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 1rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

// --------------------------------------------------------------------------
// Avatar
// --------------------------------------------------------------------------

const AVATAR_SIZES = {
  sm: "size-8 text-2xs",
  md: "size-12 text-base",
  lg: "size-18 text-xl",
  xl: "size-26 text-2xl",
} as const;

export function Avatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex shrink-0 select-none items-center justify-center rounded-full",
        "bg-plum-100 font-display font-semibold uppercase tracking-wide text-plum-700",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

// --------------------------------------------------------------------------
// Layout helpers
// --------------------------------------------------------------------------

export function Container({
  narrow,
  className,
  children,
}: {
  narrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "mx-auto w-full px-4 sm:px-6",
        narrow ? "max-w-3xl" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-sand-600">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-plum-50 text-plum-400">
        {icon}
      </span>
      <h3 className="text-xl">{title}</h3>
      <p className="max-w-sm text-sm text-sand-600">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "animate-pulse rounded-sm bg-sand-200/70",
        className,
      )}
    />
  );
}

export function StatTile({
  label,
  value,
  meta,
  metaTone = "muted",
  currency,
}: {
  label: string;
  value: string | number;
  meta?: ReactNode;
  metaTone?: "muted" | "success" | "warning";
  /** Currency totals are longer than counts and need a smaller step. */
  currency?: boolean;
}) {
  const metaColour = {
    muted: "text-sand-600",
    success: "text-success-600",
    warning: "text-warning-600",
  }[metaTone];

  return (
    <div className="rounded-lg border border-sand-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-sand-600">
        {label}
      </p>
      <p
        className={clsx(
          "mt-2 font-display font-semibold leading-none numeric",
          currency ? "text-2xl whitespace-nowrap" : "text-3xl",
        )}
      >
        {value}
      </p>
      {meta && (
        <p className={clsx("mt-2 flex items-center gap-1 text-xs", metaColour)}>
          {meta}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// A small inline icon used by Field's error state, so this module has no
// circular dependency on the icon set.
// --------------------------------------------------------------------------

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

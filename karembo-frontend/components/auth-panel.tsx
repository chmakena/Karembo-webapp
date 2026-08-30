"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "./icons";
import { Alert, Button, Card, Field, Input } from "./ui";

type Mode = "signin" | "register";

/** Client-side pre-checks. The server re-validates everything; these exist to
 *  give immediate feedback rather than to be the source of truth. */
function validate(mode: Mode, values: Record<string, string>) {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Enter your password.";
  } else if (mode === "register" && values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (mode === "register" && values.full_name.trim().length < 2) {
    errors.full_name = "Enter your full name.";
  }

  return errors;
}

export function AuthPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, register, user } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [values, setValues] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const next = searchParams.get("next") ?? "/bookings";

  // Someone already signed in has no business on this page.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  function update(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear the field's error as soon as the user starts fixing it.
    // Named `remaining` rather than `next` to avoid shadowing the redirect target.
    setErrors((current) => {
      if (!current[field]) return current;
      const remaining = { ...current };
      delete remaining[field];
      return remaining;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate(mode, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(values.email.trim(), values.password);
        toast.success("Signed in.");
      } else {
        await register({
          email: values.email.trim(),
          password: values.password,
          full_name: values.full_name.trim(),
          phone: values.phone.trim() || undefined,
        });
        toast.success("Account created. Welcome to Karembo.");
      }
      router.replace(next);
    } catch (error) {
      if (error instanceof ApiError) {
        // Map the server's complaint back onto the field it concerns, so the
        // message appears where the user can act on it.
        if (error.status === 409) {
          setErrors({ email: error.message });
        } else if (error.status === 422 && /password/i.test(error.message)) {
          setErrors({ password: error.message });
        } else if (error.status === 422) {
          setErrors({ email: error.message });
        } else if (error.isUnauthorized) {
          setErrors({ password: error.message });
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-8">
      <div
        className="mb-6 flex gap-2 rounded-full bg-sand-100 p-1"
        role="tablist"
        aria-label="Sign in or register"
      >
        {(["signin", "register"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={mode === option}
            onClick={() => {
              setMode(option);
              setErrors({});
            }}
            className={clsx(
              "flex-1 cursor-pointer rounded-full py-2 text-sm font-semibold transition-colors",
              mode === option
                ? "bg-white text-plum-700 shadow-xs"
                : "text-sand-600 hover:text-sand-900",
            )}
          >
            {option === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {mode === "register" && (
          <Field
            label="Full name"
            htmlFor="auth-name"
            required
            error={errors.full_name}
          >
            <Input
              id="auth-name"
              autoComplete="name"
              value={values.full_name}
              invalid={Boolean(errors.full_name)}
              aria-describedby={errors.full_name ? "auth-name-error" : undefined}
              onChange={(event) => update("full_name", event.target.value)}
              placeholder="Wanjiku Njoroge"
            />
          </Field>
        )}

        <Field label="Email" htmlFor="auth-email" required error={errors.email}>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={values.email}
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "auth-email-error" : undefined}
            onChange={(event) => update("email", event.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="auth-password"
          required
          error={errors.password}
          hint={mode === "register" ? "At least 8 characters." : undefined}
        >
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={values.password}
            invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "auth-password-error" : undefined
            }
            onChange={(event) => update("password", event.target.value)}
          />
        </Field>

        {mode === "register" && (
          <Field
            label="Phone"
            htmlFor="auth-phone"
            hint="Optional. Only used to reach you about your appointment."
          >
            <Input
              id="auth-phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+254 700 000 000"
            />
          </Field>
        )}

        <Button type="submit" block size="lg" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {mode === "signin" && (
        <Alert tone="info" className="mt-6">
          <p className="font-medium">Trying the demo?</p>
          <p className="mt-1 numeric">
            Customer: wanjiku@example.com / karembo-demo
            <br />
            Admin: admin@karembo.test / karembo-admin
          </p>
        </Alert>
      )}
    </Card>
  );
}

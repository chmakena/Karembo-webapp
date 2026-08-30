"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, initials } from "@/lib/format";
import { Loader2 } from "./icons";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeading,
  Skeleton,
} from "./ui";

/**
 * Handles the auth gate, then hands off to the forms.
 *
 * The split lets `Forms` seed its fields from a `useState` initialiser rather
 * than syncing them in from an effect — the profile is guaranteed to exist by
 * the time it mounts.
 */
export function AccountSettings() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/signin?next=${encodeURIComponent("/account")}`);
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <Skeleton className="h-96 rounded-lg" />;
  }

  return <Forms user={user} />;
}

function Forms({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const router = useRouter();
  const { setUser, signOut } = useAuth();

  const [profile, setProfile] = useState({
    full_name: user.full_name,
    phone: user.phone ?? "",
  });
  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );

  const saveProfile = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
      }),
    onSuccess: (updated) => {
      setUser(updated);
      setProfileErrors({});
      toast.success("Profile updated.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        setProfileErrors({ full_name: error.message });
      } else {
        toast.error(error.message);
      }
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api.auth.changePassword({
        current_password: passwords.current,
        new_password: passwords.next,
      }),
    onSuccess: () => {
      setPasswords({ current: "", next: "" });
      setPasswordErrors({});
      toast.success("Password changed.");
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        // A 401 here means the *current* password was wrong, not that the
        // session expired — point at the right field.
        if (error.isUnauthorized) {
          setPasswordErrors({ current: error.message });
        } else if (error.status === 422) {
          setPasswordErrors({ next: error.message });
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("Could not change your password.");
      }
    },
  });

  return (
    <>
      <PageHeading eyebrow="Your account" title="Account settings" />

      <Card className="mt-8">
        <div className="flex items-center gap-4">
          <Avatar initials={initials(user.full_name)} size="lg" />
          <div>
            <p className="font-display text-xl font-semibold">
              {user.full_name}
            </p>
            <p className="text-sm text-sand-600">{user.email}</p>
            <div className="mt-2 flex items-center gap-2">
              {user.role === "admin" && <Badge tone="brand">Admin</Badge>}
              <span className="text-xs text-sand-500">
                Member since {formatDate(user.created_at)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl">Your details</h2>
        <p className="mt-1 text-sm text-sand-600">
          Your email is used to sign in and can&rsquo;t be changed here.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (profile.full_name.trim().length < 2) {
              setProfileErrors({ full_name: "Enter your full name." });
              return;
            }
            saveProfile.mutate();
          }}
          noValidate
        >
          <Field
            label="Full name"
            htmlFor="acct-name"
            required
            error={profileErrors.full_name}
          >
            <Input
              id="acct-name"
              value={profile.full_name}
              invalid={Boolean(profileErrors.full_name)}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  full_name: event.target.value,
                }))
              }
            />
          </Field>
          <Field
            label="Phone"
            htmlFor="acct-phone"
            hint="Leave blank to remove it."
          >
            <Input
              id="acct-phone"
              type="tel"
              value={profile.phone}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="+254 700 000 000"
            />
          </Field>
          <Button type="submit" disabled={saveProfile.isPending}>
            {saveProfile.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl">Password</h2>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const found: Record<string, string> = {};
            if (!passwords.current) {
              found.current = "Enter your current password.";
            }
            if (passwords.next.length < 8) {
              found.next = "New password must be at least 8 characters.";
            }
            if (Object.keys(found).length > 0) {
              setPasswordErrors(found);
              return;
            }
            changePassword.mutate();
          }}
          noValidate
        >
          <Field
            label="Current password"
            htmlFor="acct-current"
            required
            error={passwordErrors.current}
          >
            <Input
              id="acct-current"
              type="password"
              autoComplete="current-password"
              value={passwords.current}
              invalid={Boolean(passwordErrors.current)}
              onChange={(event) =>
                setPasswords((current) => ({
                  ...current,
                  current: event.target.value,
                }))
              }
            />
          </Field>
          <Field
            label="New password"
            htmlFor="acct-next"
            required
            error={passwordErrors.next}
            hint="At least 8 characters."
          >
            <Input
              id="acct-next"
              type="password"
              autoComplete="new-password"
              value={passwords.next}
              invalid={Boolean(passwordErrors.next)}
              onChange={(event) =>
                setPasswords((current) => ({
                  ...current,
                  next: event.target.value,
                }))
              }
            />
          </Field>
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Change password
          </Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl">Sign out</h2>
        <p className="mt-1 text-sm text-sand-600">
          You&rsquo;ll need to sign in again to see your bookings.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => {
            signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </Card>
    </>
  );
}

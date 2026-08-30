"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { ArrowLeft, LogOut } from "../icons";
import { Avatar, Badge, Button, ButtonLink } from "../ui";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/team", label: "Team & rota" },
];

export function AdminNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/admin"
            className="flex shrink-0 items-baseline gap-0.5 font-display text-xl font-bold tracking-tight text-plum-800"
          >
            Karembo
            <span aria-hidden className="size-1.5 rounded-full bg-gold-400" />
            <span className="ml-2 font-sans text-sm font-normal text-sand-500">
              Studio
            </span>
          </Link>

          <nav
            className="flex items-center gap-5 overflow-x-auto"
            aria-label="Admin"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "shrink-0 border-b-2 py-2 text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "border-plum-600 text-plum-700"
                    : "border-transparent text-sand-600 hover:text-sand-900",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ButtonLink
            href="/"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <ArrowLeft className="size-3.5" />
            Customer site
          </ButtonLink>
          <Badge tone="brand">Admin</Badge>
          {user && (
            <Avatar
              initials={initials(user.full_name)}
              size="sm"
              className="hidden sm:flex"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

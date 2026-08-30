"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/format";
import { Avatar, Button, ButtonLink } from "./ui";
import { LayoutDashboard, LogOut, Menu, X } from "./icons";

const LINKS = [
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/bookings", label: "My bookings" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight text-plum-800"
          >
            Karembo
            <span aria-hidden className="size-1.5 rounded-full bg-gold-400" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "border-b-2 py-2 text-sm font-medium transition-colors",
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

        <div className="flex items-center gap-3">
          {/* Render nothing identity-shaped until the stored token is checked,
              so the header doesn't flash "Sign in" at an authenticated user. */}
          {isLoading ? (
            <div className="size-8 animate-pulse rounded-full bg-sand-200" />
          ) : user ? (
            <>
              {isAdmin && (
                <ButtonLink
                  href="/admin"
                  variant="secondary"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <LayoutDashboard className="size-3.5" />
                  Studio
                </ButtonLink>
              )}
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-sand-100"
                title={user.full_name}
              >
                <Avatar initials={initials(user.full_name)} size="sm" />
                <span className="hidden text-sm font-medium text-sand-800 lg:inline">
                  {user.full_name.split(" ")[0]}
                </span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <ButtonLink href="/signin" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/book" size="sm">
                Book now
              </ButtonLink>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-sand-200 bg-white px-4 py-2 md:hidden"
          aria-label="Main"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={clsx(
                "flex tap-target items-center border-b border-sand-100 text-sm font-medium last:border-0",
                isActive(link.href) ? "text-plum-700" : "text-sand-700",
              )}
            >
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex tap-target items-center gap-2 border-t border-sand-100 text-sm font-medium text-plum-700"
            >
              <LayoutDashboard className="size-4" />
              Studio
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

#!/usr/bin/env python3
"""Generate the Karembo static mockups.

The page chrome (head, header, nav, footer) is identical across every screen, so
it lives here once instead of being copy-pasted into eleven HTML files where it
would drift. Each screen contributes only its `<main>` content.

    python3 design/build.py

Writes design/screens/*.html and design/index.html. The generated files are
plain static HTML with no build step or network dependency — open any of them
directly in a browser.
"""

from __future__ import annotations

import html
from pathlib import Path

ROOT = Path(__file__).parent
SCREENS = ROOT / "screens"

# --------------------------------------------------------------------------
# Icons — lucide-style 24x24 stroke paths, inlined so the mockups need no
# network access or icon package.
# --------------------------------------------------------------------------
ICONS = {
    "calendar": '<path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/>',
    "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    "scissors": '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
    "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "alert": '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/>',
    "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
    "arrow-left": '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    "chevron-left": '<path d="m15 18-6-6 6-6"/>',
    "chevron-right": '<path d="m9 18 6-6-6-6"/>',
    "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    "star": '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    "map-pin": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    "phone": '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92"/>',
    "mail": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
    "sparkles": '<path d="M12 3l1.9 5.8L19.7 10l-5.8 1.9L12 17.7l-1.9-5.8L4.3 10l5.8-1.2z"/><path d="M19 3v4M17 5h4"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 7.4 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.51 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.91 9H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.51"/>',
    "trend": '<path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    "layout": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    "inbox": '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "edit": '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    "palette": '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2"/>',
}


def icon(name: str, size: int = 20, cls: str = "") -> str:
    """Render an inline SVG icon."""
    paths = ICONS[name]
    class_attr = f' class="{cls}"' if cls else ""
    return (
        f'<svg{class_attr} width="{size}" height="{size}" viewBox="0 0 24 24" '
        f'fill="none" stroke="currentColor" stroke-width="1.75" '
        f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f"{paths}</svg>"
    )


# --------------------------------------------------------------------------
# Page chrome
# --------------------------------------------------------------------------

CUSTOMER_NAV = [
    ("Services", "03-services.html"),
    ("Book", "04-booking.html"),
    ("My bookings", "06-my-bookings.html"),
]

ADMIN_NAV = [
    ("Overview", "08-admin-dashboard.html"),
    ("Bookings", "09-admin-bookings.html"),
    ("Services", "10-admin-services.html"),
    ("Team & rota", "11-admin-rota.html"),
]


def header(active: str, mode: str = "customer") -> str:
    """Site header. `mode` picks the customer or admin navigation."""
    links = ADMIN_NAV if mode == "admin" else CUSTOMER_NAV
    nav_items = "".join(
        f'<a class="k-nav-link{" k-nav-link-active" if label == active else ""}" '
        f'href="{href}">{label}</a>'
        for label, href in links
    )

    if mode == "admin":
        right = (
            '<div class="k-row" style="gap:var(--k-space-3)">'
            '<span class="k-badge k-badge-brand">Admin</span>'
            '<div class="k-avatar k-avatar-sm" title="Karembo Front Desk">KF</div>'
            "</div>"
        )
        brand_suffix = '<span class="k-subtle" style="font-family:var(--k-font-body);font-size:var(--k-text-sm);font-weight:400;margin-left:var(--k-space-2)">Studio</span>'
    else:
        right = (
            '<div class="k-row" style="gap:var(--k-space-3)">'
            '<a class="k-btn k-btn-ghost k-btn-sm" href="07-auth.html">Sign in</a>'
            '<a class="k-btn k-btn-primary k-btn-sm" href="04-booking.html">Book now</a>'
            "</div>"
        )
        brand_suffix = ""

    return f"""<header class="k-header">
  <div class="k-container k-row-between">
    <div class="k-row" style="gap:var(--k-space-8)">
      <a class="k-logo" href="02-home.html">Karembo</a>{brand_suffix}
      <nav class="k-nav" aria-label="Main">{nav_items}</nav>
    </div>
    {right}
  </div>
</header>"""


FOOTER = f"""<footer style="background:var(--k-surface-inverse);color:var(--k-plum-100);margin-top:var(--k-space-24)">
  <div class="k-container" style="padding-block:var(--k-space-12)">
    <div class="k-grid k-grid-4" style="gap:var(--k-space-8)">
      <div>
        <div class="k-logo" style="color:#fff">Karembo</div>
        <p class="k-body-sm" style="margin-top:var(--k-space-3);color:var(--k-plum-200);max-width:26ch">
          A salon on Nyali Road, Mombasa. Protective styling, nails and skin, by appointment.
        </p>
      </div>
      <div>
        <h4 class="k-eyebrow" style="color:var(--k-gold-300)">Visit</h4>
        <p class="k-body-sm" style="margin-top:var(--k-space-3);color:var(--k-plum-200)">
          {icon("map-pin", 14)} 14 Nyali Road, Mombasa<br>
          {icon("phone", 14)} +254 700 000 000<br>
          {icon("mail", 14)} hello@karembo.co.ke
        </p>
      </div>
      <div>
        <h4 class="k-eyebrow" style="color:var(--k-gold-300)">Opening hours</h4>
        <p class="k-body-sm k-numeric" style="margin-top:var(--k-space-3);color:var(--k-plum-200)">
          Tue&ndash;Fri&nbsp;&nbsp;09:00&ndash;18:00<br>
          Saturday&nbsp;&nbsp;08:00&ndash;17:00<br>
          Sun &amp; Mon&nbsp;&nbsp;Closed
        </p>
      </div>
      <div>
        <h4 class="k-eyebrow" style="color:var(--k-gold-300)">Design system</h4>
        <p class="k-body-sm" style="margin-top:var(--k-space-3)">
          <a href="01-foundations.html" style="color:var(--k-plum-100)">Foundations</a><br>
          <a href="../index.html" style="color:var(--k-plum-100)">All screens</a>
        </p>
      </div>
    </div>
    <p class="k-body-sm" style="margin-top:var(--k-space-10);padding-top:var(--k-space-6);border-top:1px solid rgb(255 255 255 / .12);color:var(--k-plum-300)">
      Static design mockup &mdash; Karembo salon booking. Not a live application.
    </p>
  </div>
</footer>"""


def page(title: str, body: str, active: str = "", mode: str = "customer",
         note: str = "", asset_prefix: str = "../assets") -> str:
    """Wrap screen content in the full HTML document."""
    banner = ""
    if note:
        banner = f"""<div style="background:var(--k-plum-900);color:var(--k-plum-100);font-size:var(--k-text-xs);text-align:center;padding:var(--k-space-2) var(--k-space-4)">
  <strong style="color:var(--k-gold-300)">Mockup</strong> &middot; {html.escape(note)}
</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} &mdash; Karembo</title>
<meta name="description" content="Karembo salon booking &mdash; UI/UX design mockup.">
<link rel="stylesheet" href="{asset_prefix}/tokens.css">
<link rel="stylesheet" href="{asset_prefix}/components.css">
</head>
<body>
{banner}
{header(active, mode)}
<main id="main">
{body}
</main>
{FOOTER}
</body>
</html>"""


def status_badge(status: str) -> str:
    """Map a booking status to its pill. Mirrors the app's status vocabulary."""
    mapping = {
        "confirmed": ("k-badge-success", "Confirmed"),
        "pending": ("k-badge-warning", "Pending"),
        "completed": ("k-badge-info", "Completed"),
        "cancelled": ("k-badge-danger", "Cancelled"),
        "no_show": ("k-badge-neutral", "No show"),
    }
    cls, label = mapping[status]
    return f'<span class="k-badge {cls} k-badge-dot">{label}</span>'


def kes(cents: int) -> str:
    """Format minor units as KES, matching the app's currency helper.

    The app uses Intl with locale en-KE, which renders the KES symbol as "Ksh"
    rather than the ISO code. The mockups follow suit so design and build agree.
    """
    return f"Ksh&nbsp;{cents // 100:,}"

#!/usr/bin/env python3
"""Write the Karembo mockups to disk.

    python3 design/generate.py

Produces design/index.html (the gallery) and design/screens/*.html. Everything is
static, self-contained HTML — no build step, no network, no JavaScript required.
"""

from __future__ import annotations

import html
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from build import ICONS, SCREENS, icon, page  # noqa: E402
import screens_src as S  # noqa: E402

ROOT = Path(__file__).parent

# (filename, title, nav label, mode, note, builder)
PAGES = [
    ("01-foundations.html", "Foundations", "", "customer",
     "Design tokens, components and states — the specification the app is built from.",
     S.screen_foundations),
    ("02-home.html", "Home", "", "customer",
     "Customer landing page.", S.screen_home),
    ("03-services.html", "Services", "Services", "customer",
     "Service catalogue with category filtering and search.", S.screen_services),
    ("04-booking.html", "Book an appointment", "Book", "customer",
     "Booking flow, step 3 of 4 — the calendar and slot picker.", S.screen_booking),
    ("05-confirmation.html", "Booking confirmed", "Book", "customer",
     "Post-booking confirmation with the reference code.", S.screen_confirmation),
    ("06-my-bookings.html", "My bookings", "My bookings", "customer",
     "Customer booking history, upcoming and past.", S.screen_my_bookings),
    ("07-auth.html", "Sign in", "", "customer",
     "Sign in and registration, including an inline validation error.", S.screen_auth),
    ("08-admin-dashboard.html", "Admin overview", "Overview", "admin",
     "Staff dashboard — today's diary, weekly counters and stylist load.",
     S.screen_admin_dashboard),
    ("09-admin-bookings.html", "Admin bookings", "Bookings", "admin",
     "All bookings with search, status and stylist filters.", S.screen_admin_bookings),
    ("10-admin-services.html", "Admin services", "Services", "admin",
     "Service catalogue management, including the create form.", S.screen_admin_services),
    ("11-admin-rota.html", "Admin team & rota", "Team & rota", "admin",
     "Stylist profiles, weekly shifts, service coverage and time off.",
     S.screen_admin_rota),
]

GALLERY_GROUPS = [
    ("Foundations", "The visual language every screen is built from.",
     ["01-foundations.html"]),
    ("Customer", "What someone booking an appointment sees.",
     ["02-home.html", "03-services.html", "04-booking.html", "05-confirmation.html",
      "06-my-bookings.html", "07-auth.html"]),
    ("Admin", "What the salon's front desk uses to run the day.",
     ["08-admin-dashboard.html", "09-admin-bookings.html", "10-admin-services.html",
      "11-admin-rota.html"]),
]


def build_gallery() -> str:
    """The index that links every screen."""
    by_file = {f: (title, note) for f, title, _, _, note, _ in PAGES}

    groups_html = ""
    for group_name, group_desc, files in GALLERY_GROUPS:
        cards = ""
        for filename in files:
            title, note = by_file[filename]
            number = filename.split("-")[0]
            cards += f"""<a class="k-card k-card-interactive" href="screens/{filename}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:var(--k-space-2)">
  <div class="k-row-between">
    <span class="k-badge k-badge-neutral k-numeric">{number}</span>
    <span style="color:var(--k-primary)">{icon("arrow-right", 16)}</span>
  </div>
  <h3 class="k-h3" style="margin-top:var(--k-space-2)">{html.escape(title)}</h3>
  <p class="k-body-sm k-muted">{html.escape(note)}</p>
</a>"""
        groups_html += f"""<section style="margin-top:var(--k-space-12)">
  <h2 class="k-h2">{group_name}</h2>
  <p class="k-muted" style="margin-top:var(--k-space-2);max-width:60ch">{group_desc}</p>
  <div class="k-grid k-grid-3" style="margin-top:var(--k-space-6)">{cards}</div>
</section>"""

    body = f"""<div class="k-container k-section">
  <span class="k-eyebrow">Karembo &middot; salon booking</span>
  <h1 class="k-display-1" style="margin-top:var(--k-space-4)">UI/UX design</h1>
  <p class="k-lead" style="max-width:64ch;margin-top:var(--k-space-5)">
    Eleven screens covering the whole product: the customer booking journey and the
    admin tooling the salon runs it with. Every screen is static HTML styled purely
    from the tokens in <code>assets/tokens.css</code>, so this doubles as the
    implementation reference for the Next.js app.
  </p>

  <div class="k-grid k-grid-4" style="margin-top:var(--k-space-10)">
    <div class="k-stat"><p class="k-stat-label">Screens</p><p class="k-stat-value">11</p></div>
    <div class="k-stat"><p class="k-stat-label">Design tokens</p><p class="k-stat-value">120+</p></div>
    <div class="k-stat"><p class="k-stat-label">Components</p><p class="k-stat-value">18</p></div>
    <div class="k-stat"><p class="k-stat-label">Breakpoints</p><p class="k-stat-value">3</p></div>
  </div>

  <div class="k-alert k-alert-info" style="margin-top:var(--k-space-8);max-width:80ch">
    <span class="k-alert-icon">{icon("palette", 18)}</span>
    <div>
      <strong>Start with Foundations.</strong> It documents the palette with contrast ratios,
      the type scale, the 4px spacing system, and every interactive component in each of its
      states &mdash; including loading, empty and error.
    </div>
  </div>

  {groups_html}
</div>"""

    return page("UI/UX design", body, mode="customer", asset_prefix="assets")


def main() -> int:
    SCREENS.mkdir(parents=True, exist_ok=True)

    written = []
    for filename, title, nav_label, mode, note, builder in PAGES:
        markup = page(title, builder(), active=nav_label, mode=mode, note=note)
        (SCREENS / filename).write_text(markup, encoding="utf-8")
        written.append(f"screens/{filename}")

    (ROOT / "index.html").write_text(build_gallery(), encoding="utf-8")
    written.append("index.html")

    print(f"{len(ICONS)} icons inlined")
    for path in written:
        size = (ROOT / path).stat().st_size
        print(f"  {path:<34} {size / 1024:5.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

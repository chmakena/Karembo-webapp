#!/usr/bin/env python3
"""Body content for each Karembo mockup screen.

Kept separate from build.py so the chrome/plumbing and the screen designs can be
read independently. Each `screen_*` function returns the inner HTML of `<main>`.
"""

from __future__ import annotations

from build import icon, kes, status_badge

# --------------------------------------------------------------------------
# Sample data — one consistent cast across every screen, so the mockups read
# as one product rather than a set of unrelated pictures.
# --------------------------------------------------------------------------

SERVICES = [
    ("Signature Cut & Style", "Hair", 60, 250000,
     "A consultation-led cut finished with a blow-dry and styling to suit your face shape."),
    ("Silk Press", "Hair", 90, 380000,
     "Deep cleanse, protein treatment and a heat-styled finish that keeps movement for weeks."),
    ("Knotless Box Braids", "Braids", 240, 650000,
     "Medium knotless braids, mid-back length. Includes wash and scalp prep."),
    ("Cornrows & Lines", "Braids", 120, 300000,
     "Clean straight-back cornrows or a custom pattern, sealed with a light oil finish."),
    ("Gel Manicure", "Nails", 60, 180000,
     "Shaping, cuticle work and a gel colour or French finish that lasts two to three weeks."),
    ("Acrylic Full Set", "Nails", 120, 450000,
     "Full acrylic extensions built to your preferred length and shape, colour included."),
    ("Classic Lash Extensions", "Beauty", 120, 500000,
     "One-to-one lash application for a natural lift. Includes an aftercare kit."),
    ("Glow Facial", "Beauty", 60, 350000,
     "Double cleanse, gentle exfoliation, extraction and a hydrating mask."),
    ("Bridal Hair & Makeup", "Bridal", 180, 1500000,
     "Trial session plus wedding-day hair and makeup, with a stylist on call."),
]

STAFF = [
    ("Amina Karisa", "AK", "Senior Stylist",
     "Fifteen years behind the chair and a specialist in protective styling and knotless braid work."),
    ("Brian Otieno", "BO", "Barber & Stylist",
     "Precision cuts, fades and beard shaping. Trained in Nairobi and Cape Town."),
    ("Cynthia Wanjiru", "CW", "Nail Technician",
     "Nail artist with a light hand for gel work and a following for her custom acrylic sets."),
    ("Doreen Achieng", "DA", "Beauty Therapist",
     "Facials, brows and lashes. Focuses on barrier-safe treatments for sensitive skin."),
    ("Esther Mwikali", "EM", "Bridal Lead",
     "Leads the bridal team and has styled over two hundred weddings across the coast."),
]

CATEGORIES = ["All", "Hair", "Braids", "Nails", "Beauty", "Bridal"]


def duration(mins: int) -> str:
    """Render minutes the way a human reads them: 90 -> '1h 30m'."""
    if mins < 60:
        return f"{mins}m"
    hours, rest = divmod(mins, 60)
    return f"{hours}h" if rest == 0 else f"{hours}h {rest}m"


def service_card(name, cat, mins, price, desc, *, selected=False, href="04-booking.html"):
    ring = " k-card-selected" if selected else ""
    return f"""<a href="{href}" class="k-card k-card-interactive{ring}" style="display:flex;flex-direction:column;gap:var(--k-space-3);text-decoration:none;color:inherit">
  <div class="k-row-between" style="align-items:flex-start">
    <span class="k-badge k-badge-brand">{cat}</span>
    <span class="k-body-sm k-muted k-row" style="gap:var(--k-space-1)">{icon("clock", 14)} {duration(mins)}</span>
  </div>
  <h3 class="k-h3">{name}</h3>
  <p class="k-body-sm k-muted" style="flex:1">{desc}</p>
  <div class="k-row-between" style="margin-top:var(--k-space-2)">
    <span class="k-price" style="color:var(--k-plum-700)">{kes(price)}</span>
    <span class="k-body-sm" style="color:var(--k-primary);font-weight:var(--k-weight-semibold)">Book {icon("arrow-right", 14)}</span>
  </div>
</a>"""


def stepper(current: int) -> str:
    """Booking progress. Completed steps are marked with a tick, not just colour."""
    steps = ["Service", "Stylist", "Date & time", "Confirm"]
    out = []
    for index, label in enumerate(steps, start=1):
        if index < current:
            cls, marker = "k-step-done", icon("check", 14)
        elif index == current:
            cls, marker = "k-step-current", str(index)
        else:
            cls, marker = "", str(index)
        aria = ' aria-current="step"' if index == current else ""
        out.append(
            f'<li class="k-step {cls}"{aria}>'
            f'<span class="k-step-marker">{marker}</span>{label}</li>'
        )
        if index < len(steps):
            out.append('<li class="k-step-line" aria-hidden="true"></li>')
    return f'<ol class="k-stepper">{"".join(out)}</ol>'


# ==========================================================================
# 01 — Foundations
# ==========================================================================

def screen_foundations() -> str:
    def swatch_row(label, tokens):
        cells = ""
        for step, hexv in tokens:
            # Pick a readable label colour for the chip based on its lightness.
            text = "#fff" if step >= 500 else "var(--k-sand-900)"
            cells += f"""<div style="flex:1;min-width:0">
  <div style="height:64px;border-radius:var(--k-radius-md);background:{hexv};display:flex;align-items:flex-end;padding:var(--k-space-2);color:{text};font-size:var(--k-text-2xs);font-weight:600">{step}</div>
  <code style="font-size:var(--k-text-2xs);color:var(--k-text-subtle)">{hexv}</code>
</div>"""
        return f"""<div style="margin-bottom:var(--k-space-6)">
  <h4 class="k-h4" style="margin-bottom:var(--k-space-3)">{label}</h4>
  <div style="display:flex;gap:var(--k-space-2)">{cells}</div>
</div>"""

    plum = [(50, "#fdf5f9"), (100, "#f8e6f0"), (200, "#f0cbe0"), (300, "#e3a3c8"),
            (400, "#d0709f"), (500, "#b44d7c"), (600, "#8a2f5b"), (700, "#6b2447"),
            (800, "#4d1a33"), (900, "#3a1327")]
    gold = [(50, "#fdf9f0"), (100, "#f7ebd6"), (200, "#eed7ac"), (300, "#ddb974"),
            (400, "#cc9f4d"), (500, "#b8863a"), (600, "#96692c"), (700, "#6f4d21")]
    sand = [(50, "#fbf9f8"), (100, "#f5f1ef"), (200, "#e9e3e0"), (300, "#d6cdc9"),
            (400, "#b3a7a2"), (500, "#8a7d78"), (600, "#665c58"), (700, "#4a423f"),
            (800, "#2f2a28"), (900, "#1c1917")]

    type_rows = ""
    for cls, name, size, use in [
        ("k-display-1", "Display 1", "60px", "Hero headline"),
        ("k-display-2", "Display 2", "48px", "Section hero"),
        ("k-h1", "Heading 1", "36px", "Page title"),
        ("k-h2", "Heading 2", "28px", "Section heading"),
        ("k-h3", "Heading 3", "22px", "Card title"),
        ("k-h4", "Heading 4", "18px", "Sub-heading"),
    ]:
        type_rows += f"""<tr>
  <td><span class="{cls}">Karembo</span></td>
  <td class="k-body-sm k-muted"><code>.{cls}</code></td>
  <td class="k-body-sm k-muted k-numeric">{size}</td>
  <td class="k-body-sm k-muted">{use}</td>
</tr>"""

    space_rows = ""
    for token, px in [("1", 4), ("2", 8), ("3", 12), ("4", 16), ("5", 20),
                      ("6", 24), ("8", 32), ("10", 40), ("12", 48), ("16", 64)]:
        space_rows += f"""<tr>
  <td><code class="k-body-sm">--k-space-{token}</code></td>
  <td class="k-body-sm k-numeric k-muted">{px}px</td>
  <td><div style="height:12px;width:{px}px;background:var(--k-plum-400);border-radius:2px"></div></td>
</tr>"""

    badges = "".join(
        f'<span class="k-badge {c} k-badge-dot">{l}</span>'
        for c, l in [("k-badge-success", "Confirmed"), ("k-badge-warning", "Pending"),
                     ("k-badge-info", "Completed"), ("k-badge-danger", "Cancelled"),
                     ("k-badge-neutral", "No show"), ("k-badge-brand", "Braids"),
                     ("k-badge-gold", "Bridal")]
    )

    slots = ""
    for time, state in [("09:00", ""), ("09:30", ""), ("10:00", "k-slot-selected"),
                        ("10:30", "k-slot-disabled"), ("11:00", ""), ("11:30", "k-slot-disabled")]:
        aria = ' aria-disabled="true"' if "disabled" in state else ""
        checked = ' aria-checked="true"' if "selected" in state else ' aria-checked="false"'
        slots += f'<span class="k-slot {state}" role="radio"{checked}{aria}>{time}</span>'

    return f"""<div class="k-container k-section">
  <span class="k-eyebrow">Design system</span>
  <h1 class="k-display-2" style="margin-top:var(--k-space-3)">Foundations</h1>
  <p class="k-lead" style="max-width:62ch;margin-top:var(--k-space-4)">
    Every value below is a CSS custom property in <code>tokens.css</code>. The Next.js app
    re-declares the same set through Tailwind&rsquo;s <code>@theme</code>, so the design and the
    implementation have exactly one place each to change.
  </p>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Colour</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6);max-width:62ch">
    Plum carries the brand; gold is an accent used sparingly, never for interactive states.
    Neutrals are warm-tinted so they sit beside the plum rather than reading as cold grey.
  </p>
  {swatch_row("Plum &mdash; brand", plum)}
  {swatch_row("Gold &mdash; accent", gold)}
  {swatch_row("Sand &mdash; neutral", sand)}

  <div class="k-alert k-alert-info" style="max-width:70ch">
    <span class="k-alert-icon">{icon("alert", 18)}</span>
    <div><strong>Contrast.</strong> Body text uses sand-900 on white (16.1:1) and sand-600 for
    muted text (7.0:1). Plum-600 on white reaches 6.4:1, so it is safe for both text and
    button fills. Gold is never used for text below 18px on white.</div>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Type</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6);max-width:62ch">
    Fraunces (serif) for display sizes gives the salon an editorial feel; Geist carries body
    copy where legibility at 14&ndash;16px matters more than character.
  </p>
  <div class="k-table-wrap">
    <table class="k-table">
      <thead><tr><th>Sample</th><th>Class</th><th>Size</th><th>Used for</th></tr></thead>
      <tbody>{type_rows}</tbody>
    </table>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Spacing</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6);max-width:62ch">
    A 4px base. Restricting every gap to this scale is what keeps vertical rhythm consistent
    across screens built at different times.
  </p>
  <div class="k-table-wrap" style="max-width:520px">
    <table class="k-table">
      <thead><tr><th>Token</th><th>Value</th><th>Scale</th></tr></thead>
      <tbody>{space_rows}</tbody>
    </table>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Buttons</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6)">
    All variants clear a 44px tap target. Booking happens on phones, often one-handed.
  </p>
  <div class="k-card">
    <div class="k-row" style="flex-wrap:wrap;gap:var(--k-space-3)">
      <button class="k-btn k-btn-primary">Confirm booking</button>
      <button class="k-btn k-btn-secondary">Change stylist</button>
      <button class="k-btn k-btn-ghost">Back</button>
      <button class="k-btn k-btn-danger">Cancel appointment</button>
      <button class="k-btn k-btn-primary" disabled>Unavailable</button>
    </div>
    <hr class="k-divider">
    <div class="k-row" style="flex-wrap:wrap;gap:var(--k-space-3)">
      <button class="k-btn k-btn-primary k-btn-lg">Large</button>
      <button class="k-btn k-btn-primary">Default</button>
      <button class="k-btn k-btn-primary k-btn-sm">Small</button>
    </div>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Status</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6);max-width:62ch">
    Each pill pairs a tinted background with a leading dot, so status never depends on hue
    alone &mdash; it survives greyscale printing and colour-blind viewing.
  </p>
  <div class="k-card"><div class="k-row" style="flex-wrap:wrap;gap:var(--k-space-2)">{badges}</div></div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Forms</h2>
  <div class="k-grid k-grid-2" style="margin-top:var(--k-space-6)">
    <div class="k-card k-stack">
      <div class="k-field">
        <label class="k-label" for="fd-name">Full name<span class="k-required">*</span></label>
        <input class="k-input" id="fd-name" value="Wanjiku Njoroge">
      </div>
      <div class="k-field">
        <label class="k-label" for="fd-svc">Service</label>
        <select class="k-select" id="fd-svc"><option>Silk Press &mdash; 1h 30m</option></select>
      </div>
      <div class="k-field">
        <label class="k-label" for="fd-notes">Notes for your stylist</label>
        <textarea class="k-textarea" id="fd-notes" placeholder="Anything we should know?"></textarea>
        <p class="k-hint">Allergies, hair history, or a reference photo you&rsquo;ll bring.</p>
      </div>
    </div>
    <div class="k-card k-stack">
      <div class="k-field">
        <label class="k-label" for="fd-email">Email<span class="k-required">*</span></label>
        <input class="k-input k-input-error" id="fd-email" value="wanjiku@" aria-invalid="true" aria-describedby="fd-email-err">
        <p class="k-error" id="fd-email-err">{icon("alert", 14)} Enter a valid email address.</p>
      </div>
      <div class="k-field">
        <label class="k-label" for="fd-phone">Phone</label>
        <input class="k-input" id="fd-phone" placeholder="+254 700 000 000">
        <p class="k-hint">We only use this to reach you about your appointment.</p>
      </div>
      <div>
        <span class="k-label">Category</span>
        <div class="k-chip-group">
          <span class="k-chip k-chip-active">All <span class="k-chip-count">14</span></span>
          <span class="k-chip">Hair <span class="k-chip-count">5</span></span>
          <span class="k-chip">Braids <span class="k-chip-count">2</span></span>
        </div>
      </div>
    </div>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Slot picker</h2>
  <p class="k-muted" style="margin:var(--k-space-3) 0 var(--k-space-6);max-width:62ch">
    The core control of the product. It is a radio group semantically; taken slots are struck
    through as well as dimmed.
  </p>
  <div class="k-card">
    <div class="k-slot-grid" role="radiogroup" aria-label="Available times">{slots}</div>
  </div>

  <hr class="k-divider" style="margin-block:var(--k-space-12)">

  <h2 class="k-h2">Loading &amp; empty states</h2>
  <div class="k-grid k-grid-2" style="margin-top:var(--k-space-6)">
    <div class="k-card">
      <div class="k-skeleton" style="height:14px;width:35%"></div>
      <div class="k-skeleton" style="height:26px;width:75%;margin-top:var(--k-space-4)"></div>
      <div class="k-skeleton" style="height:14px;width:100%;margin-top:var(--k-space-4)"></div>
      <div class="k-skeleton" style="height:14px;width:85%;margin-top:var(--k-space-2)"></div>
      <div class="k-skeleton" style="height:44px;width:140px;margin-top:var(--k-space-6);border-radius:var(--k-radius-full)"></div>
    </div>
    <div class="k-card">
      <div class="k-empty" style="padding-block:var(--k-space-8)">
        <div class="k-empty-icon">{icon("calendar", 28)}</div>
        <h3 class="k-h3">No appointments yet</h3>
        <p class="k-muted k-body-sm" style="max-width:34ch">
          When you book, your appointment will appear here with everything you need to find us.
        </p>
        <a class="k-btn k-btn-primary" href="03-services.html">Browse services</a>
      </div>
    </div>
  </div>
</div>"""


# ==========================================================================
# 02 — Home
# ==========================================================================

def screen_home() -> str:
    cards = "".join(service_card(*s) for s in SERVICES[:3])
    team = "".join(f"""<div class="k-card" style="text-align:center">
  <div class="k-avatar k-avatar-xl" style="margin:0 auto">{initials}</div>
  <h3 class="k-h3" style="margin-top:var(--k-space-4)">{name}</h3>
  <p class="k-eyebrow" style="margin-top:var(--k-space-1)">{title}</p>
  <p class="k-body-sm k-muted" style="margin-top:var(--k-space-3)">{bio}</p>
</div>""" for name, initials, title, bio in STAFF[:4])

    steps = "".join(f"""<div style="text-align:center">
  <div class="k-avatar k-avatar-lg" style="margin:0 auto;background:var(--k-plum-600);color:#fff">{icon(ico, 28)}</div>
  <h3 class="k-h3" style="margin-top:var(--k-space-4)">{title}</h3>
  <p class="k-body-sm k-muted" style="margin-top:var(--k-space-2)">{body}</p>
</div>""" for ico, title, body in [
        ("scissors", "Pick a service", "Browse the menu with real durations and prices &mdash; no surprises at the till."),
        ("user", "Choose your stylist", "See who does what, and book the person you trust with your hair."),
        ("calendar", "Take a real slot", "Times shown are genuinely free. The slot is held the moment you confirm."),
    ])

    return f"""<section style="background:linear-gradient(160deg,var(--k-plum-900) 0%,var(--k-plum-700) 55%,var(--k-plum-600) 100%);color:#fff;overflow:hidden;position:relative">
  <div class="k-container" style="padding-block:var(--k-space-24)">
    <div style="max-width:60ch">
      <span class="k-badge k-badge-gold">{icon("map-pin", 12)} Nyali Road, Mombasa</span>
      <h1 class="k-display-1" style="margin-top:var(--k-space-5);color:#fff">
        Your chair is<br>already waiting.
      </h1>
      <p class="k-lead" style="color:var(--k-plum-100);margin-top:var(--k-space-6);max-width:52ch">
        Karembo is a salon for protective styling, nails and skin. Pick a service, pick your
        stylist, and take a time that is genuinely free &mdash; booked in under a minute.
      </p>
      <div class="k-row" style="margin-top:var(--k-space-8);flex-wrap:wrap">
        <a class="k-btn k-btn-lg" href="04-booking.html" style="background:#fff;color:var(--k-plum-700)">
          Book an appointment {icon("arrow-right", 18)}
        </a>
        <a class="k-btn k-btn-lg k-btn-ghost" href="03-services.html" style="color:#fff;border-color:rgb(255 255 255 / .35)">
          See the full menu
        </a>
      </div>
      <div class="k-row" style="margin-top:var(--k-space-10);gap:var(--k-space-8);flex-wrap:wrap;color:var(--k-plum-100)">
        <span class="k-body-sm k-row">{icon("check-circle", 16)} Free cancellation up to 12h before</span>
        <span class="k-body-sm k-row">{icon("check-circle", 16)} Five stylists, fourteen services</span>
      </div>
    </div>
  </div>
</section>

<section class="k-container k-section">
  <div class="k-row-between" style="flex-wrap:wrap;margin-bottom:var(--k-space-8)">
    <div>
      <span class="k-eyebrow">How it works</span>
      <h2 class="k-h1" style="margin-top:var(--k-space-2)">Three steps, no phone call</h2>
    </div>
  </div>
  <div class="k-grid k-grid-3">{steps}</div>
</section>

<section style="background:var(--k-surface-sunken)">
  <div class="k-container k-section">
    <div class="k-row-between" style="flex-wrap:wrap;margin-bottom:var(--k-space-8)">
      <div>
        <span class="k-eyebrow">Popular right now</span>
        <h2 class="k-h1" style="margin-top:var(--k-space-2)">Most-booked services</h2>
      </div>
      <a class="k-btn k-btn-secondary" href="03-services.html">All 14 services {icon("arrow-right", 16)}</a>
    </div>
    <div class="k-grid k-grid-3">{cards}</div>
  </div>
</section>

<section class="k-container k-section">
  <div style="margin-bottom:var(--k-space-8)">
    <span class="k-eyebrow">The team</span>
    <h2 class="k-h1" style="margin-top:var(--k-space-2)">Who you&rsquo;ll be sitting with</h2>
  </div>
  <div class="k-grid k-grid-4">{team}</div>
</section>"""


# ==========================================================================
# 03 — Services catalogue
# ==========================================================================

def screen_services() -> str:
    counts = {"All": len(SERVICES)}
    for _, cat, *_ in SERVICES:
        counts[cat] = counts.get(cat, 0) + 1

    chips = "".join(
        f'<button class="k-chip{" k-chip-active" if c == "All" else ""}">'
        f'{c} <span class="k-chip-count">{counts.get(c, 0)}</span></button>'
        for c in CATEGORIES
    )
    cards = "".join(service_card(*s) for s in SERVICES)

    return f"""<div class="k-container k-section">
  <span class="k-eyebrow">Service menu</span>
  <h1 class="k-display-2" style="margin-top:var(--k-space-3)">Everything we do</h1>
  <p class="k-lead" style="max-width:58ch;margin-top:var(--k-space-4)">
    Real durations and real prices. What you see is what the stylist blocks out for you.
  </p>

  <div class="k-card" style="margin-top:var(--k-space-8);display:flex;gap:var(--k-space-4);flex-wrap:wrap;align-items:center">
    <div style="position:relative;flex:1;min-width:240px">
      <span style="position:absolute;left:var(--k-space-4);top:50%;transform:translateY(-50%);color:var(--k-text-subtle)">{icon("search", 18)}</span>
      <input class="k-input" style="padding-left:var(--k-space-12)" placeholder="Search services&hellip;" aria-label="Search services">
    </div>
    <select class="k-select" style="width:auto;min-width:190px" aria-label="Sort by">
      <option>Sort: Most popular</option>
      <option>Price: low to high</option>
      <option>Duration: shortest first</option>
    </select>
  </div>

  <div class="k-chip-group" style="margin-top:var(--k-space-5)" role="group" aria-label="Filter by category">{chips}</div>

  <p class="k-body-sm k-muted" style="margin-top:var(--k-space-6)">Showing <strong>{len(SERVICES)}</strong> services</p>

  <div class="k-grid k-grid-3" style="margin-top:var(--k-space-4)">{cards}</div>
</div>"""


# ==========================================================================
# 04 — Booking flow (date & time step)
# ==========================================================================

def screen_booking() -> str:
    # A month grid for September 2026. The 1st is a Tuesday, so the leading
    # blanks put it in the right column.
    leading = 1  # Monday blank
    days_html = '<div class="k-day k-day-empty" aria-hidden="true"></div>' * leading
    availability = {
        # day: slot count (0 = closed or full)
        1: 12, 2: 9, 3: 14, 4: 11, 5: 16, 6: 0, 7: 0,
        8: 10, 9: 3, 10: 12, 11: 8, 12: 15, 13: 0, 14: 0,
        15: 11, 16: 7, 17: 0, 18: 9, 19: 14, 20: 0, 21: 0,
        22: 6, 23: 10, 24: 12, 25: 4, 26: 13, 27: 0, 28: 0,
        29: 8, 30: 11,
    }
    for day in range(1, 31):
        count = availability.get(day, 0)
        classes = ["k-day"]
        aria = ""
        if day == 9:
            classes.append("k-day-selected")
            aria = ' aria-current="date"'
        elif count == 0:
            classes.append("k-day-disabled")
            aria = ' aria-disabled="true"'
        dot = '<span class="k-day-dot"></span>' if count else ""
        label = f"{day} September, {count} slots" if count else f"{day} September, closed"
        days_html += (
            f'<button class="{" ".join(classes)}"{aria} aria-label="{label}">'
            f"<span>{day}</span>{dot}</button>"
        )

    dow = "".join(f'<div class="k-calendar-dow">{d}</div>'
                  for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])

    # Slots for the selected day. Two taken, one selected — the state the
    # customer most often sees.
    slot_data = [
        ("09:00", ""), ("09:15", ""), ("09:30", "k-slot-disabled"),
        ("09:45", "k-slot-disabled"), ("10:00", ""), ("10:15", ""),
        ("10:30", "k-slot-selected"), ("10:45", ""), ("11:00", ""),
        ("11:15", "k-slot-disabled"), ("11:30", ""), ("11:45", ""),
    ]
    def slot(time: str, state: str) -> str:
        checked = "true" if "selected" in state else "false"
        disabled = ' aria-disabled="true"' if "disabled" in state else ""
        return (
            f'<span class="k-slot {state}" role="radio" '
            f'aria-checked="{checked}"{disabled}>{time}</span>'
        )

    morning = "".join(slot(t, s) for t, s in slot_data)
    afternoon = "".join(slot(t, s) for t, s in [
        ("14:00", ""), ("14:15", ""), ("14:30", ""), ("14:45", "k-slot-disabled"),
        ("15:00", "k-slot-disabled"), ("15:15", ""), ("15:30", ""), ("15:45", ""),
        ("16:00", ""), ("16:15", ""), ("16:30", ""), ("16:45", "k-slot-disabled"),
    ])

    return f"""<div class="k-container" style="padding-block:var(--k-space-10)">
  <div style="margin-bottom:var(--k-space-8)">
    {stepper(3)}
  </div>

  <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:var(--k-space-8);align-items:start">
    <div>
      <h1 class="k-h1">Pick a date and time</h1>
      <p class="k-muted" style="margin-top:var(--k-space-2)">
        Times shown are free in <strong>Amina Karisa&rsquo;s</strong> diary for a
        <strong>Signature Cut &amp; Style</strong> (1h).
      </p>

      <div class="k-grid" style="grid-template-columns:minmax(0,320px) minmax(0,1fr);gap:var(--k-space-6);margin-top:var(--k-space-6);align-items:start">
        <div class="k-calendar">
          <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
            <button class="k-btn k-btn-ghost k-btn-sm" aria-label="Previous month">{icon("chevron-left", 18)}</button>
            <strong>September 2026</strong>
            <button class="k-btn k-btn-ghost k-btn-sm" aria-label="Next month">{icon("chevron-right", 18)}</button>
          </div>
          <div class="k-calendar-head">{dow}</div>
          <div class="k-calendar-grid">{days_html}</div>
          <div class="k-row" style="margin-top:var(--k-space-5);gap:var(--k-space-4);flex-wrap:wrap">
            <span class="k-body-sm k-muted k-row" style="gap:var(--k-space-1)">
              <span class="k-day-dot" style="width:5px;height:5px"></span> Has availability
            </span>
            <span class="k-body-sm k-subtle">Sun &amp; Mon closed</span>
          </div>
        </div>

        <div>
          <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
            <h2 class="k-h3">Wednesday 9 September</h2>
            <span class="k-badge k-badge-neutral">3 slots left</span>
          </div>

          <div class="k-alert k-alert-warning" style="margin-bottom:var(--k-space-5)">
            <span class="k-alert-icon">{icon("alert", 18)}</span>
            <div>This is a busy day &mdash; only three times remain. Slots are held only once you confirm.</div>
          </div>

          <p class="k-eyebrow" style="margin-bottom:var(--k-space-3)">Morning</p>
          <div class="k-slot-grid" role="radiogroup" aria-label="Morning times">{morning}</div>

          <p class="k-eyebrow" style="margin:var(--k-space-6) 0 var(--k-space-3)">Afternoon</p>
          <div class="k-slot-grid" role="radiogroup" aria-label="Afternoon times">{afternoon}</div>

          <p class="k-hint" style="margin-top:var(--k-space-5)">
            Struck-through times are already taken. The salon closes 13:00&ndash;14:00.
          </p>
        </div>
      </div>
    </div>

    <aside class="k-card" style="position:sticky;top:calc(var(--k-header-height) + var(--k-space-6))">
      <h2 class="k-h3">Your appointment</h2>
      <div style="margin-top:var(--k-space-5)">
        <div class="k-summary-row">
          <span class="k-summary-key">Service</span>
          <span class="k-summary-val">Signature Cut &amp; Style</span>
        </div>
        <div class="k-summary-row">
          <span class="k-summary-key">Stylist</span>
          <span class="k-summary-val">Amina Karisa</span>
        </div>
        <div class="k-summary-row">
          <span class="k-summary-key">Date</span>
          <span class="k-summary-val">Wed 9 Sep 2026</span>
        </div>
        <div class="k-summary-row">
          <span class="k-summary-key">Time</span>
          <span class="k-summary-val k-numeric">10:30 &ndash; 11:30</span>
        </div>
        <div class="k-summary-row">
          <span class="k-summary-key">Duration</span>
          <span class="k-summary-val">1h</span>
        </div>
      </div>
      <div class="k-summary-total">
        <span class="k-muted">Total</span>
        <span class="k-price" style="color:var(--k-plum-700)">{kes(250000)}</span>
      </div>
      <p class="k-hint">Payable at the salon. No card needed to book.</p>
      <a class="k-btn k-btn-primary k-btn-block k-btn-lg" href="05-confirmation.html" style="margin-top:var(--k-space-5)">
        Continue {icon("arrow-right", 18)}
      </a>
      <button class="k-btn k-btn-ghost k-btn-block" style="margin-top:var(--k-space-2)">
        {icon("arrow-left", 16)} Change stylist
      </button>
    </aside>
  </div>
</div>"""


# ==========================================================================
# 05 — Confirmation
# ==========================================================================

def screen_confirmation() -> str:
    return f"""<div class="k-container k-container-narrow k-section">
  <div class="k-card" style="text-align:center;padding:var(--k-space-12) var(--k-space-8)">
    <div class="k-avatar k-avatar-xl" style="margin:0 auto;background:var(--k-success-50);color:var(--k-success-600)">
      {icon("check", 44)}
    </div>
    <h1 class="k-h1" style="margin-top:var(--k-space-6)">You&rsquo;re booked in</h1>
    <p class="k-lead" style="margin-top:var(--k-space-3)">
      We&rsquo;ve emailed the details to <strong>wanjiku@example.com</strong>.
    </p>

    <div style="display:inline-flex;align-items:center;gap:var(--k-space-3);margin-top:var(--k-space-6);padding:var(--k-space-3) var(--k-space-5);background:var(--k-plum-50);border:1px dashed var(--k-plum-200);border-radius:var(--k-radius-full)">
      <span class="k-body-sm k-muted">Reference</span>
      <strong class="k-numeric" style="font-family:var(--k-font-mono);letter-spacing:.06em">KMB-7F3A9C2E</strong>
    </div>

    <hr class="k-divider">

    <div style="text-align:left;max-width:420px;margin:0 auto">
      <div class="k-summary-row">
        <span class="k-summary-key">Service</span>
        <span class="k-summary-val">Signature Cut &amp; Style</span>
      </div>
      <div class="k-summary-row">
        <span class="k-summary-key">Stylist</span>
        <span class="k-summary-val">Amina Karisa</span>
      </div>
      <div class="k-summary-row">
        <span class="k-summary-key">When</span>
        <span class="k-summary-val">Wed 9 Sep 2026, 10:30</span>
      </div>
      <div class="k-summary-row">
        <span class="k-summary-key">Where</span>
        <span class="k-summary-val">14 Nyali Road, Mombasa</span>
      </div>
      <div class="k-summary-total">
        <span class="k-muted">Payable at the salon</span>
        <span class="k-price" style="color:var(--k-plum-700)">{kes(250000)}</span>
      </div>
    </div>

    <div class="k-row" style="justify-content:center;margin-top:var(--k-space-8);flex-wrap:wrap">
      <a class="k-btn k-btn-primary" href="06-my-bookings.html">View my bookings</a>
      <button class="k-btn k-btn-secondary">{icon("calendar", 16)} Add to calendar</button>
    </div>
  </div>

  <div class="k-alert k-alert-info" style="margin-top:var(--k-space-6)">
    <span class="k-alert-icon">{icon("clock", 18)}</span>
    <div>
      <strong>Need to change it?</strong> You can reschedule or cancel free of charge up to
      12 hours before your appointment, from your bookings page.
    </div>
  </div>
</div>"""


# ==========================================================================
# 06 — My bookings
# ==========================================================================

def screen_my_bookings() -> str:
    def booking_card(ref, service, stylist, initials, when, price, status, *, upcoming=True):
        actions = ""
        if upcoming:
            actions = f"""<div class="k-row" style="flex-wrap:wrap;margin-top:var(--k-space-4)">
  <button class="k-btn k-btn-secondary k-btn-sm">{icon("calendar", 14)} Reschedule</button>
  <button class="k-btn k-btn-danger k-btn-sm">{icon("x", 14)} Cancel</button>
</div>"""
        elif status == "completed":
            actions = f"""<div class="k-row" style="flex-wrap:wrap;margin-top:var(--k-space-4)">
  <button class="k-btn k-btn-secondary k-btn-sm">{icon("arrow-right", 14)} Book again</button>
</div>"""
        return f"""<div class="k-card">
  <div class="k-row-between" style="align-items:flex-start;flex-wrap:wrap;gap:var(--k-space-4)">
    <div class="k-row" style="gap:var(--k-space-4);align-items:flex-start">
      <div class="k-avatar">{initials}</div>
      <div>
        <h3 class="k-h3">{service}</h3>
        <p class="k-body-sm k-muted" style="margin-top:var(--k-space-1)">with {stylist}</p>
        <p class="k-body-sm k-row" style="margin-top:var(--k-space-3);gap:var(--k-space-4);flex-wrap:wrap">
          <span class="k-row" style="gap:var(--k-space-1)">{icon("calendar", 14)} {when}</span>
          <span class="k-row k-numeric" style="gap:var(--k-space-1)">{icon("map-pin", 14)} Nyali Road</span>
        </p>
      </div>
    </div>
    <div style="text-align:right">
      {status_badge(status)}
      <p class="k-price" style="margin-top:var(--k-space-3);color:var(--k-plum-700)">{kes(price)}</p>
      <p class="k-body-sm k-subtle" style="font-family:var(--k-font-mono);margin-top:var(--k-space-1)">{ref}</p>
    </div>
  </div>
  {actions}
</div>"""

    upcoming = booking_card("KMB-7F3A9C2E", "Signature Cut &amp; Style", "Amina Karisa", "AK",
                            "Wed 9 Sep 2026, 10:30", 250000, "confirmed")
    upcoming += booking_card("KMB-1B8D4E5F", "Gel Manicure", "Cynthia Wanjiru", "CW",
                             "Sat 19 Sep 2026, 14:00", 180000, "confirmed")

    past = booking_card("KMB-9C2E4A17", "Silk Press", "Amina Karisa", "AK",
                        "Fri 15 Aug 2026, 11:00", 380000, "completed", upcoming=False)
    past += booking_card("KMB-4D7A1B93", "Glow Facial", "Doreen Achieng", "DA",
                         "Thu 31 Jul 2026, 16:00", 350000, "completed", upcoming=False)
    past += booking_card("KMB-2E5F8C41", "Classic Lash Extensions", "Doreen Achieng", "DA",
                         "Tue 8 Jul 2026, 09:00", 500000, "cancelled", upcoming=False)

    return f"""<div class="k-container k-section">
  <div class="k-row-between" style="flex-wrap:wrap;gap:var(--k-space-4)">
    <div>
      <span class="k-eyebrow">Your account</span>
      <h1 class="k-display-2" style="margin-top:var(--k-space-3)">My bookings</h1>
    </div>
    <a class="k-btn k-btn-primary" href="04-booking.html">{icon("plus", 16)} New booking</a>
  </div>

  <div class="k-row" style="margin-top:var(--k-space-8);gap:var(--k-space-2);border-bottom:1px solid var(--k-border)">
    <button class="k-nav-link k-nav-link-active" style="background:none;border:0;border-bottom:2px solid var(--k-primary);cursor:pointer;padding-inline:var(--k-space-2)">
      Upcoming <span class="k-badge k-badge-brand" style="margin-left:var(--k-space-2)">2</span>
    </button>
    <button class="k-nav-link" style="background:none;border:0;border-bottom:2px solid transparent;cursor:pointer;padding-inline:var(--k-space-2)">
      Past <span class="k-badge k-badge-neutral" style="margin-left:var(--k-space-2)">3</span>
    </button>
  </div>

  <div class="k-stack" style="margin-top:var(--k-space-6)">{upcoming}</div>

  <h2 class="k-h2" style="margin-top:var(--k-space-16)">Earlier visits</h2>
  <div class="k-stack" style="margin-top:var(--k-space-6)">{past}</div>
</div>"""


# ==========================================================================
# 07 — Auth
# ==========================================================================

def screen_auth() -> str:
    return f"""<div class="k-container" style="padding-block:var(--k-space-16)">
  <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--k-space-16);align-items:center;max-width:1000px;margin:0 auto">
    <div>
      <span class="k-eyebrow">Welcome back</span>
      <h1 class="k-display-2" style="margin-top:var(--k-space-3)">Sign in to Karembo</h1>
      <p class="k-lead" style="margin-top:var(--k-space-4)">
        Your bookings, your stylist, your history &mdash; all in one place.
      </p>
      <ul style="list-style:none;padding:0;margin-top:var(--k-space-8);display:grid;gap:var(--k-space-4)">
        <li class="k-row" style="gap:var(--k-space-3)">
          <span style="color:var(--k-success-600);flex:none">{icon("check-circle", 20)}</span>
          <span class="k-body-sm">Rebook a past service in two taps</span>
        </li>
        <li class="k-row" style="gap:var(--k-space-3)">
          <span style="color:var(--k-success-600);flex:none">{icon("check-circle", 20)}</span>
          <span class="k-body-sm">Reschedule or cancel without calling</span>
        </li>
        <li class="k-row" style="gap:var(--k-space-3)">
          <span style="color:var(--k-success-600);flex:none">{icon("check-circle", 20)}</span>
          <span class="k-body-sm">Keep notes your stylist should know</span>
        </li>
      </ul>
    </div>

    <div class="k-card" style="padding:var(--k-space-8)">
      <div class="k-row" style="gap:var(--k-space-2);background:var(--k-surface-sunken);padding:var(--k-space-1);border-radius:var(--k-radius-full);margin-bottom:var(--k-space-6)">
        <button class="k-btn k-btn-sm" style="flex:1;background:var(--k-surface);color:var(--k-plum-700);box-shadow:var(--k-shadow-xs)">Sign in</button>
        <button class="k-btn k-btn-ghost k-btn-sm" style="flex:1">Create account</button>
      </div>

      <form class="k-stack" onsubmit="return false">
        <div class="k-field">
          <label class="k-label" for="au-email">Email<span class="k-required">*</span></label>
          <input class="k-input" id="au-email" type="email" placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="k-field">
          <label class="k-label" for="au-pw">Password<span class="k-required">*</span></label>
          <input class="k-input" id="au-pw" type="password" placeholder="At least 8 characters" autocomplete="current-password">
          <p class="k-hint">Minimum 8 characters.</p>
        </div>
        <button class="k-btn k-btn-primary k-btn-block k-btn-lg" type="submit">Sign in</button>
      </form>

      <hr class="k-divider">
      <p class="k-body-sm k-muted" style="text-align:center">
        New to Karembo? <a href="#">Create an account</a> &mdash; it takes about twenty seconds.
      </p>
    </div>
  </div>
</div>"""


# ==========================================================================
# 08 — Admin dashboard
# ==========================================================================

def screen_admin_dashboard() -> str:
    stats = "".join(f"""<div class="k-stat">
  <p class="k-stat-label">{label}</p>
  <p class="k-stat-value{" k-stat-value-currency" if currency else ""}">{value}</p>
  <p class="k-stat-meta k-row" style="gap:var(--k-space-1);color:{colour}">{meta}</p>
</div>""" for label, value, meta, colour, currency in [
        ("Today", "8", f'{icon("clock", 13)} 2 still to arrive', "var(--k-text-muted)", False),
        ("This week", "41", f'{icon("trend", 13)} up 12% on last week', "var(--k-success-600)", False),
        ("Week revenue", "KES&nbsp;138,400", f'{icon("trend", 13)} 34 paid visits', "var(--k-success-600)", True),
        ("Cancellations", "3", f'{icon("alert", 13)} 7.3% of the week', "var(--k-warning-600)", False),
    ])

    today_rows = "".join(f"""<tr>
  <td class="k-numeric"><strong>{time}</strong></td>
  <td>
    <div class="k-row" style="gap:var(--k-space-3)">
      <div class="k-avatar k-avatar-sm">{initials}</div>
      <div>
        <div style="font-weight:var(--k-weight-medium)">{customer}</div>
        <div class="k-body-sm k-muted">{service}</div>
      </div>
    </div>
  </td>
  <td class="k-body-sm">{stylist}</td>
  <td>{status_badge(status)}</td>
  <td style="text-align:right" class="k-numeric">{kes(price)}</td>
</tr>""" for time, initials, customer, service, stylist, status, price in [
        ("09:00", "WN", "Wanjiku Njoroge", "Silk Press", "Amina", "completed", 380000),
        ("10:30", "JM", "James Mwangi", "Signature Cut", "Brian", "completed", 250000),
        ("11:00", "FA", "Fatuma Ali", "Knotless Box Braids", "Amina", "confirmed", 650000),
        ("14:00", "GK", "Grace Kamau", "Gel Manicure", "Cynthia", "confirmed", 180000),
        ("15:30", "MO", "Mercy Okoth", "Glow Facial", "Doreen", "pending", 350000),
        ("16:00", "AN", "Aisha Noor", "Brow Shape & Tint", "Doreen", "confirmed", 120000),
    ])

    load = "".join(f"""<div style="margin-bottom:var(--k-space-4)">
  <div class="k-row-between" style="margin-bottom:var(--k-space-2)">
    <span class="k-body-sm" style="font-weight:var(--k-weight-medium)">{name}</span>
    <span class="k-body-sm k-muted k-numeric">{count}</span>
  </div>
  <div style="height:8px;background:var(--k-sand-100);border-radius:var(--k-radius-full);overflow:hidden">
    <div style="height:100%;width:{pct}%;background:var(--k-plum-500);border-radius:var(--k-radius-full)"></div>
  </div>
</div>""" for name, count, pct in [
        ("Amina Karisa", 18, 100), ("Cynthia Wanjiru", 14, 78),
        ("Doreen Achieng", 11, 61), ("Brian Otieno", 9, 50), ("Esther Mwikali", 4, 22),
    ])

    return f"""<div class="k-container" style="padding-block:var(--k-space-10)">
  <div class="k-row-between" style="flex-wrap:wrap;gap:var(--k-space-4)">
    <div>
      <span class="k-eyebrow">Sunday 30 August 2026</span>
      <h1 class="k-h1" style="margin-top:var(--k-space-2)">Good morning, front desk</h1>
    </div>
    <div class="k-row">
      <button class="k-btn k-btn-secondary">{icon("calendar", 16)} This week</button>
      <a class="k-btn k-btn-primary" href="09-admin-bookings.html">{icon("plus", 16)} New booking</a>
    </div>
  </div>

  <div class="k-grid k-grid-4" style="margin-top:var(--k-space-8)">{stats}</div>

  <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--k-space-6);margin-top:var(--k-space-6);align-items:start">
    <div>
      <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
        <h2 class="k-h2">Today&rsquo;s diary</h2>
        <a class="k-body-sm" href="09-admin-bookings.html">View all bookings {icon("arrow-right", 14)}</a>
      </div>
      <div class="k-table-wrap">
        <table class="k-table k-table-stack">
          <thead><tr><th>Time</th><th>Client</th><th>Stylist</th><th>Status</th><th style="text-align:right">Value</th></tr></thead>
          <tbody>{today_rows}</tbody>
        </table>
      </div>
    </div>

    <div class="k-stack">
      <div class="k-card">
        <h3 class="k-h3">Stylist load</h3>
        <p class="k-body-sm k-muted" style="margin:var(--k-space-1) 0 var(--k-space-5)">Bookings, last 30 days</p>
        {load}
      </div>

      <div class="k-card">
        <h3 class="k-h3">Most booked</h3>
        <p class="k-body-sm k-muted" style="margin:var(--k-space-1) 0 var(--k-space-4)">Last 30 days</p>
        <div class="k-stack" style="--k-space-4:var(--k-space-3)">
          <div class="k-row-between"><span class="k-body-sm">Knotless Box Braids</span><strong class="k-body-sm k-numeric">12</strong></div>
          <div class="k-row-between"><span class="k-body-sm">Gel Manicure</span><strong class="k-body-sm k-numeric">11</strong></div>
          <div class="k-row-between"><span class="k-body-sm">Signature Cut &amp; Style</span><strong class="k-body-sm k-numeric">9</strong></div>
          <div class="k-row-between"><span class="k-body-sm">Silk Press</span><strong class="k-body-sm k-numeric">7</strong></div>
        </div>
      </div>

      <div class="k-alert k-alert-warning">
        <span class="k-alert-icon">{icon("alert", 18)}</span>
        <div><strong>Esther is on leave</strong> 12&ndash;16 Sep. Two bridal enquiries need reassigning.</div>
      </div>
    </div>
  </div>
</div>"""


# ==========================================================================
# 09 — Admin bookings
# ==========================================================================

def screen_admin_bookings() -> str:
    rows = "".join(f"""<tr>
  <td data-label="Reference"><span style="font-family:var(--k-font-mono);font-size:var(--k-text-xs)">{ref}</span></td>
  <td data-label="Client">
    <div class="k-row" style="gap:var(--k-space-3)">
      <div class="k-avatar k-avatar-sm">{initials}</div>
      <div>
        <div style="font-weight:var(--k-weight-medium)">{customer}</div>
        <div class="k-body-sm k-subtle">{email}</div>
      </div>
    </div>
  </td>
  <td data-label="Service">
    <div>{service}</div>
    <div class="k-body-sm k-muted">{stylist}</div>
  </td>
  <td data-label="When" class="k-numeric">{when}</td>
  <td data-label="Status">{status_badge(status)}</td>
  <td data-label="Value" style="text-align:right" class="k-numeric">{kes(price)}</td>
  <td data-label="" style="text-align:right">
    <button class="k-btn k-btn-ghost k-btn-sm" aria-label="Edit {ref}">{icon("edit", 16)}</button>
  </td>
</tr>""" for ref, initials, customer, email, service, stylist, when, status, price in [
        ("KMB-7F3A9C2E", "WN", "Wanjiku Njoroge", "wanjiku@example.com", "Signature Cut &amp; Style", "Amina Karisa", "Wed 9 Sep, 10:30", "confirmed", 250000),
        ("KMB-1B8D4E5F", "GK", "Grace Kamau", "grace@example.com", "Gel Manicure", "Cynthia Wanjiru", "Sat 19 Sep, 14:00", "confirmed", 180000),
        ("KMB-5A2C7D91", "FA", "Fatuma Ali", "fatuma@example.com", "Knotless Box Braids", "Amina Karisa", "Fri 11 Sep, 09:00", "pending", 650000),
        ("KMB-9C2E4A17", "JM", "James Mwangi", "james@example.com", "Silk Press", "Amina Karisa", "Fri 15 Aug, 11:00", "completed", 380000),
        ("KMB-2E5F8C41", "MO", "Mercy Okoth", "mercy@example.com", "Classic Lash Extensions", "Doreen Achieng", "Tue 8 Jul, 09:00", "cancelled", 500000),
        ("KMB-8D1F3B62", "AN", "Aisha Noor", "aisha@example.com", "Glow Facial", "Doreen Achieng", "Thu 3 Sep, 16:00", "no_show", 350000),
    ])

    return f"""<div class="k-container" style="padding-block:var(--k-space-10)">
  <div class="k-row-between" style="flex-wrap:wrap;gap:var(--k-space-4)">
    <div>
      <span class="k-eyebrow">Operations</span>
      <h1 class="k-h1" style="margin-top:var(--k-space-2)">Bookings</h1>
    </div>
    <a class="k-btn k-btn-primary" href="#">{icon("plus", 16)} Book for a client</a>
  </div>

  <div class="k-card" style="margin-top:var(--k-space-6);display:flex;gap:var(--k-space-3);flex-wrap:wrap;align-items:center">
    <div style="position:relative;flex:1;min-width:220px">
      <span style="position:absolute;left:var(--k-space-4);top:50%;transform:translateY(-50%);color:var(--k-text-subtle)">{icon("search", 18)}</span>
      <input class="k-input" style="padding-left:var(--k-space-12)" placeholder="Name, email or reference&hellip;" aria-label="Search bookings">
    </div>
    <select class="k-select" style="width:auto;min-width:150px" aria-label="Status"><option>All statuses</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option></select>
    <select class="k-select" style="width:auto;min-width:150px" aria-label="Stylist"><option>All stylists</option><option>Amina Karisa</option><option>Brian Otieno</option></select>
    <input class="k-input" type="date" style="width:auto" aria-label="From date">
  </div>

  <div class="k-row-between" style="margin-top:var(--k-space-6)">
    <p class="k-body-sm k-muted">Showing <strong>6</strong> of 41 bookings this week</p>
    <div class="k-chip-group">
      <button class="k-chip k-chip-active">All</button>
      <button class="k-chip">Needs attention <span class="k-chip-count">2</span></button>
    </div>
  </div>

  <div class="k-table-wrap" style="margin-top:var(--k-space-4)">
    <table class="k-table k-table-stack">
      <thead><tr><th>Reference</th><th>Client</th><th>Service</th><th>When</th><th>Status</th><th style="text-align:right">Value</th><th></th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
</div>"""


# ==========================================================================
# 10 — Admin services
# ==========================================================================

def screen_admin_services() -> str:
    rows = ""
    for name, cat, mins, price, _desc in SERVICES:
        active = name != "Bridal Hair &amp; Makeup"
        rows += f"""<tr>
  <td data-label="Service">
    <div style="font-weight:var(--k-weight-medium)">{name}</div>
    <div class="k-body-sm k-subtle">{name.lower().replace(" & ", "-").replace(" ", "-")}</div>
  </td>
  <td data-label="Category"><span class="k-badge k-badge-brand">{cat}</span></td>
  <td data-label="Duration" class="k-numeric">{duration(mins)}</td>
  <td data-label="Price" class="k-numeric" style="text-align:right">{kes(price)}</td>
  <td data-label="Status">{'<span class="k-badge k-badge-success k-badge-dot">Active</span>' if active else '<span class="k-badge k-badge-neutral k-badge-dot">Retired</span>'}</td>
  <td data-label="" style="text-align:right">
    <button class="k-btn k-btn-ghost k-btn-sm" aria-label="Edit {name}">{icon("edit", 16)}</button>
  </td>
</tr>"""

    return f"""<div class="k-container" style="padding-block:var(--k-space-10)">
  <div class="k-row-between" style="flex-wrap:wrap;gap:var(--k-space-4)">
    <div>
      <span class="k-eyebrow">Catalogue</span>
      <h1 class="k-h1" style="margin-top:var(--k-space-2)">Services</h1>
      <p class="k-muted" style="margin-top:var(--k-space-2)">
        Duration drives the booking calendar &mdash; change it and future slots resize automatically.
      </p>
    </div>
    <button class="k-btn k-btn-primary">{icon("plus", 16)} Add service</button>
  </div>

  <div class="k-alert k-alert-info" style="margin-top:var(--k-space-6)">
    <span class="k-alert-icon">{icon("alert", 18)}</span>
    <div>
      Retiring a service hides it from customers but keeps it on past bookings, so your
      history and reporting stay intact.
    </div>
  </div>

  <div class="k-table-wrap" style="margin-top:var(--k-space-6)">
    <table class="k-table k-table-stack">
      <thead><tr><th>Service</th><th>Category</th><th>Duration</th><th style="text-align:right">Price</th><th>Status</th><th></th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>

  <h2 class="k-h2" style="margin-top:var(--k-space-16)">Add a service</h2>
  <div class="k-card" style="margin-top:var(--k-space-5);max-width:760px">
    <div class="k-grid k-grid-2">
      <div class="k-field">
        <label class="k-label" for="as-name">Name<span class="k-required">*</span></label>
        <input class="k-input" id="as-name" placeholder="e.g. Scalp Treatment">
      </div>
      <div class="k-field">
        <label class="k-label" for="as-cat">Category<span class="k-required">*</span></label>
        <select class="k-select" id="as-cat"><option>Hair</option><option>Braids</option><option>Nails</option><option>Beauty</option><option>Bridal</option></select>
      </div>
      <div class="k-field">
        <label class="k-label" for="as-dur">Duration (minutes)<span class="k-required">*</span></label>
        <input class="k-input k-numeric" id="as-dur" type="number" value="60" min="1" max="600">
        <p class="k-hint">1&ndash;600. Slots are offered every 15 minutes.</p>
      </div>
      <div class="k-field">
        <label class="k-label" for="as-price">Price (KES)<span class="k-required">*</span></label>
        <input class="k-input k-numeric" id="as-price" type="number" value="2500" min="0">
      </div>
    </div>
    <div class="k-field" style="margin-top:var(--k-space-5)">
      <label class="k-label" for="as-desc">Description</label>
      <textarea class="k-textarea" id="as-desc" placeholder="What the client should expect."></textarea>
    </div>
    <div class="k-row" style="margin-top:var(--k-space-6)">
      <button class="k-btn k-btn-primary">Create service</button>
      <button class="k-btn k-btn-ghost">Cancel</button>
    </div>
  </div>
</div>"""


# ==========================================================================
# 11 — Admin team & rota
# ==========================================================================

def screen_admin_rota() -> str:
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    # Amina's rota: Tue-Fri two shifts, Sat two shifts, Sun/Mon off.
    rota = {
        "Mon": None, "Tue": ("09:00", "13:00", "14:00", "18:00"),
        "Wed": ("09:00", "13:00", "14:00", "18:00"),
        "Thu": ("09:00", "13:00", "14:00", "18:00"),
        "Fri": ("09:00", "13:00", "14:00", "19:00"),
        "Sat": ("08:00", "13:00", "14:00", "17:00"), "Sun": None,
    }
    rota_rows = ""
    for day in days:
        shifts = rota[day]
        if shifts is None:
            cell = '<span class="k-badge k-badge-neutral">Closed</span>'
        else:
            cell = f"""<div class="k-row" style="gap:var(--k-space-2);flex-wrap:wrap">
  <span class="k-badge k-badge-brand k-numeric">{shifts[0]}&ndash;{shifts[1]}</span>
  <span class="k-badge k-badge-brand k-numeric">{shifts[2]}&ndash;{shifts[3]}</span>
</div>"""
        rota_rows += f"""<tr>
  <td data-label="Day" style="font-weight:var(--k-weight-medium)">{day}</td>
  <td data-label="Shifts">{cell}</td>
  <td data-label="" style="text-align:right">
    <button class="k-btn k-btn-ghost k-btn-sm" aria-label="Edit {day}">{icon("edit", 16)}</button>
  </td>
</tr>"""

    team = "".join(f"""<div class="k-card{' k-card-selected' if name == 'Amina Karisa' else ''}" style="cursor:pointer">
  <div class="k-row" style="gap:var(--k-space-4);align-items:flex-start">
    <div class="k-avatar">{initials}</div>
    <div style="flex:1;min-width:0">
      <div class="k-row-between">
        <h3 class="k-h4">{name}</h3>
        <span class="k-badge k-badge-success k-badge-dot">Active</span>
      </div>
      <p class="k-eyebrow" style="margin-top:var(--k-space-1)">{title}</p>
      <p class="k-body-sm k-muted" style="margin-top:var(--k-space-2)">{svc_count} services &middot; {shift_count} shifts a week</p>
    </div>
  </div>
</div>""" for name, initials, title, _bio, svc_count, shift_count in [
        ("Amina Karisa", "AK", "Senior Stylist", "", 6, 10),
        ("Brian Otieno", "BO", "Barber & Stylist", "", 3, 10),
        ("Cynthia Wanjiru", "CW", "Nail Technician", "", 3, 10),
        ("Doreen Achieng", "DA", "Beauty Therapist", "", 4, 10),
        ("Esther Mwikali", "EM", "Bridal Lead", "", 4, 3),
    ])

    coverage = "".join(f"""<label class="k-row" style="gap:var(--k-space-3);padding:var(--k-space-3);border:1px solid var(--k-border);border-radius:var(--k-radius-md);cursor:pointer;background:{'var(--k-plum-50)' if on else 'var(--k-surface)'}">
  <input type="checkbox" {'checked' if on else ''} style="width:18px;height:18px;accent-color:var(--k-plum-600)">
  <span style="flex:1">
    <span style="font-weight:var(--k-weight-medium)">{name}</span>
    <span class="k-body-sm k-muted"> &middot; {duration(mins)}</span>
  </span>
</label>""" for name, mins, on in [
        ("Signature Cut & Style", 60, True), ("Silk Press", 90, True),
        ("Knotless Box Braids", 240, True), ("Cornrows & Lines", 120, True),
        ("Gel Manicure", 60, False), ("Acrylic Full Set", 120, False),
        ("Glow Facial", 60, False), ("Bridal Hair & Makeup", 180, False),
    ])

    return f"""<div class="k-container" style="padding-block:var(--k-space-10)">
  <div class="k-row-between" style="flex-wrap:wrap;gap:var(--k-space-4)">
    <div>
      <span class="k-eyebrow">Team</span>
      <h1 class="k-h1" style="margin-top:var(--k-space-2)">Stylists &amp; rota</h1>
    </div>
    <button class="k-btn k-btn-primary">{icon("plus", 16)} Add stylist</button>
  </div>

  <div style="display:grid;grid-template-columns:340px minmax(0,1fr);gap:var(--k-space-6);margin-top:var(--k-space-8);align-items:start">
    <div class="k-stack">{team}</div>

    <div class="k-stack-lg">
      <div>
        <div class="k-row" style="gap:var(--k-space-4);margin-bottom:var(--k-space-5)">
          <div class="k-avatar k-avatar-lg">AK</div>
          <div>
            <h2 class="k-h2">Amina Karisa</h2>
            <p class="k-eyebrow" style="margin-top:var(--k-space-1)">Senior Stylist</p>
          </div>
        </div>
        <p class="k-muted" style="max-width:64ch">
          Fifteen years behind the chair and a specialist in protective styling and knotless
          braid work.
        </p>
      </div>

      <div>
        <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
          <h3 class="k-h3">Weekly rota</h3>
          <button class="k-btn k-btn-secondary k-btn-sm">{icon("edit", 14)} Edit shifts</button>
        </div>
        <div class="k-alert k-alert-warning" style="margin-bottom:var(--k-space-4)">
          <span class="k-alert-icon">{icon("alert", 18)}</span>
          <div>
            Removing a shift does <strong>not</strong> cancel appointments already inside it.
            Existing bookings stay on the calendar so you can move them deliberately.
          </div>
        </div>
        <div class="k-table-wrap">
          <table class="k-table k-table-stack">
            <thead><tr><th>Day</th><th>Shifts</th><th></th></tr></thead>
            <tbody>{rota_rows}</tbody>
          </table>
        </div>
      </div>

      <div>
        <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
          <h3 class="k-h3">Services offered</h3>
          <span class="k-badge k-badge-brand">4 of 8 selected</span>
        </div>
        <div class="k-grid k-grid-2" style="gap:var(--k-space-3)">{coverage}</div>
      </div>

      <div>
        <div class="k-row-between" style="margin-bottom:var(--k-space-4)">
          <h3 class="k-h3">Time off</h3>
          <button class="k-btn k-btn-secondary k-btn-sm">{icon("plus", 14)} Add time off</button>
        </div>
        <div class="k-card">
          <div class="k-row-between">
            <div>
              <div style="font-weight:var(--k-weight-medium)">Annual leave</div>
              <div class="k-body-sm k-muted k-numeric">Mon 12 Oct &ndash; Fri 16 Oct 2026</div>
            </div>
            <button class="k-btn k-btn-danger k-btn-sm">{icon("x", 14)} Remove</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>"""

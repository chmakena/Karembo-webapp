# Karembo — UI/UX design

The design system and screen mockups for the Karembo salon booking app.

**Open [`index.html`](index.html) in a browser to browse all eleven screens.**

Everything here is static, self-contained HTML and CSS. No build step, no network
access, no JavaScript required — open any file directly from disk.

---

## Why HTML mockups rather than a Figma file

Figma files can only be authored from inside Figma, which isn't reachable from
this environment. Rather than hand you a written description of a design, these
mockups are the design: real layouts at real breakpoints, in a browser, using the
exact tokens the application code consumes.

That has a practical advantage over a Figma file — there is no translation step
where a design drifts from its implementation. `assets/tokens.css` and the app's
`app/globals.css` declare the same values, so a change has one counterpart, not a
handoff.

If you do want this in Figma, the fastest route is to open a screen, use Figma's
"HTML to design" import, and then reconcile against
[`01-foundations.html`](screens/01-foundations.html), which documents every token
with its value and contrast ratio.

---

## Files

```
design/
├── index.html              Gallery — start here
├── assets/
│   ├── tokens.css          Design tokens (colour, type, space, radius, shadow, motion)
│   └── components.css      Component styles, expressed purely in those tokens
├── screens/
│   ├── 01-foundations.html Palette, type scale, spacing, every component state
│   ├── 02-home.html        Customer landing page
│   ├── 03-services.html    Service catalogue, filtering and search
│   ├── 04-booking.html     Booking flow step 3 — calendar and slot picker
│   ├── 05-confirmation.html Booking confirmed, with reference code
│   ├── 06-my-bookings.html Customer history, upcoming and past
│   ├── 07-auth.html        Sign in / register, with inline validation error
│   ├── 08-admin-dashboard.html Today's diary, weekly counters, stylist load
│   ├── 09-admin-bookings.html  All bookings with filters
│   ├── 10-admin-services.html  Service management and create form
│   └── 11-admin-rota.html      Stylists, shifts, service coverage, time off
├── build.py                Page chrome, icons, helpers
├── screens_src.py          Per-screen content
└── generate.py             Writes the HTML — `python3 design/generate.py`
```

The mockups are generated because the page chrome (head, header, nav, footer) is
identical on every screen. Copy-pasting it eleven times guarantees it drifts;
generating it guarantees it doesn't. The generated HTML is committed, so you never
need to run the generator to view the design.

---

## The design language

### Brand

*Karembo* is Swahili for "beauty". The salon is on Nyali Road, Mombasa.

The palette is a **deep plum** — warm and grown-up, and deliberately distinct
from the mint-and-grey palette that most booking software defaults to. A muted
**gold** provides accent, used sparingly and never for interactive state, so it
never competes with the primary action. Neutrals are **warm-tinted sand** rather
than pure grey, so they sit beside the plum instead of reading as cold.

### Colour and contrast

| Use | Token | On white | AA (4.5:1) |
|---|---|---|---|
| Body text | `--k-sand-900` `#1c1917` | 17.49:1 | pass |
| Muted text | `--k-sand-600` `#665c58` | 6.49:1 | pass |
| Subtle text | `--k-sand-500` `#7e716b` | 4.71:1 | pass |
| Primary / links | `--k-plum-600` `#8a2f5b` | 7.96:1 | pass |
| Eyebrow labels | `--k-plum-500` `#b44d7c` | 4.89:1 | pass |

White on the plum button fill is also 7.96:1, and all seven status pills sit
between 7.1:1 and 9.96:1 against their own tints.

Gold is **not** a text colour on white — `--k-gold-500` reaches only 3.23:1,
which passes the 3:1 large-text threshold but fails AA for body copy. It is used
for fills, borders, and (as `--k-gold-300`, 8.65:1) for labels on the dark plum
footer.

These figures are measured, not estimated — run `python3 design/contrast.py` to
re-verify them against `tokens.css`. That check caught a genuine failure during
design: the natural mid-scale value for subtle text (`#8a7d78`) was 3.97:1, so it
was darkened to the value above.

**Status never relies on hue alone.** Every status pill pairs a tinted background
with a leading dot and a text label, and unavailable time slots are struck through
as well as dimmed. The design survives greyscale printing and colour-blind
viewing.

### Type

- **Display** — Fraunces (serif). Editorial and considered; used at 22px and up.
- **Body** — Geist (sans). Chosen for legibility at 14–16px, where most of the
  interface lives.
- Both stacks fall back to system fonts, which is why these mockups render
  correctly with no network access.

The scale runs on a ~1.2 ratio at small sizes, opening to 1.25 for display sizes
so headings separate clearly. Times and money use `font-variant-numeric:
tabular-nums` so they align in columns.

### Spacing

A strict 4px base scale (`--k-space-1` through `--k-space-24`). Every margin,
padding, and gap in the system is one of these values. That restriction is what
keeps vertical rhythm consistent across screens built at different times.

### Motion

120–280ms, eased out. Booking is a task flow, not an experience — animation
should confirm an action, never delay it. `prefers-reduced-motion` collapses
durations to 1ms rather than removing transitions, so state changes still read as
deliberate.

---

## Accessibility

Built in, not retrofitted:

- **Touch targets** — every interactive control clears 44×44px, including the
  small button variant. Booking happens on phones, often one-handed.
- **Focus** — a single visible focus ring (`:focus-visible`) on every interactive
  element. Keyboard users get an unambiguous indicator; pointer users never see it.
- **Semantics** — the slot picker and calendar are radio groups
  (`role="radiogroup"` / `role="radio"` with `aria-checked`), not clickable divs.
  Unavailable options carry `aria-disabled`. The stepper is an ordered list with
  `aria-current="step"`.
- **Form errors** — announced by icon *and* text, associated via
  `aria-describedby`, with `aria-invalid` on the field. Never colour alone.
- **Never colour alone** — see the status note above.
- **Responsive tables** — admin tables reflow into stacked rows below 720px using
  `data-label` attributes, rather than scrolling sideways.

---

## Layout

| Breakpoint | Behaviour |
|---|---|
| `> 1024px` | Full grid. Booking uses a two-column layout with a sticky summary rail. |
| `≤ 1024px` | 4- and 3-column grids collapse to 2. |
| `≤ 720px` | Everything goes single-column; display type scales down; tables stack. |

Content is capped at 1200px (`--k-container`), with a 760px narrow variant
(`--k-container-narrow`) for reading-width pages like the confirmation screen.

---

## Component inventory

18 components, all documented with their states in
[`01-foundations.html`](screens/01-foundations.html):

Buttons (5 variants × 3 sizes) · Cards (interactive, selected) · Badges and
status pills (7) · Inputs, selects, textareas (with error state) · Filter chips ·
Slot picker · Calendar with availability dots · Stepper · Tables (with mobile
stacking) · Stat tiles · Avatars (4 sizes) · Header and nav · Alerts (4) · Empty
states · Skeleton loaders · Dividers · Summary rail · Footer.

---

## Notes on the key screens

**`04-booking.html`** is the screen that matters most. Three decisions worth
calling out:

1. **The calendar shows availability before you click into a day.** A dot marks
   days with free slots, so a customer scanning a month doesn't have to open each
   day to find out it's full. This is backed by the API's
   `GET /api/availability/days` endpoint, which returns per-day slot counts.
2. **Taken slots are shown, not hidden.** Struck through and dimmed. Hiding them
   makes a busy day look sparse rather than busy, and removes the social proof
   that the salon is in demand.
3. **The summary rail is sticky and shows the running total.** Nothing about the
   price or duration is a surprise at the confirm step.

**`11-admin-rota.html`** carries an explicit warning that removing a shift does
not cancel appointments already inside it. That mirrors the backend's actual
behaviour — existing bookings survive a rota change so a human can move them
deliberately — and the UI says so rather than letting an admin assume otherwise.

---

## Sample data

The mockups use one consistent cast — the same five stylists, the same service
menu, the same customers — as the database seed in
`karembo-backend/migrations/0002_seed_catalogue.sql`. Prices are in KES (rendered "Ksh", the local symbol); dates are
real (1 September 2026 genuinely is a Tuesday). Screens read as one product
rather than a set of unrelated pictures.

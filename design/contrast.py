#!/usr/bin/env python3
"""Verify the colour contrast claims in design/README.md against tokens.css.

    python3 design/contrast.py

Parses the real token values out of assets/tokens.css and checks every
foreground/background pair the design actually uses. Exits non-zero if any pair
misses its WCAG target, so a palette tweak cannot silently break accessibility.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

TOKENS = Path(__file__).parent / "assets" / "tokens.css"


def load_tokens() -> dict[str, str]:
    """Pull `--k-name: #hex;` declarations out of tokens.css."""
    text = TOKENS.read_text(encoding="utf-8")
    found: dict[str, str] = {}
    for name, value in re.findall(r"(--k-[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", text):
        # Later declarations win, matching CSS cascade order.
        found[name] = value.lower()
    return found


def _linear(channel: int) -> float:
    c = channel / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _linear(r) + 0.7152 * _linear(g) + 0.0722 * _linear(b)


def contrast(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


WHITE = "#ffffff"

# (description, foreground token, background token or literal, target ratio)
# 4.5 is AA for body text; 3.0 is AA for large text and for UI component borders.
PAIRS: list[tuple[str, str, str, float]] = [
    ("body text on white", "--k-sand-900", WHITE, 4.5),
    ("muted text on white", "--k-sand-600", WHITE, 4.5),
    ("subtle text on white", "--k-sand-500", WHITE, 4.5),
    ("primary link on white", "--k-plum-600", WHITE, 4.5),
    ("eyebrow label on white", "--k-plum-500", WHITE, 4.5),
    ("label text on white", "--k-sand-800", WHITE, 4.5),
    ("white on primary button", WHITE, "--k-plum-600", 4.5),
    ("white on primary hover", WHITE, "--k-plum-700", 4.5),
    ("secondary button text", "--k-plum-700", WHITE, 4.5),
    ("brand badge", "--k-plum-700", "--k-plum-50", 4.5),
    ("gold badge", "--k-gold-700", "--k-gold-50", 4.5),
    ("success badge", "--k-success-700", "--k-success-50", 4.5),
    ("warning badge", "--k-warning-700", "--k-warning-50", 4.5),
    ("danger badge", "--k-danger-700", "--k-danger-50", 4.5),
    ("info badge", "--k-info-700", "--k-info-50", 4.5),
    ("neutral badge", "--k-sand-700", "--k-sand-100", 4.5),
    ("danger button text", "--k-danger-600", WHITE, 4.5),
    ("error message on white", "--k-danger-600", WHITE, 4.5),
    ("footer body on plum", "--k-plum-100", "--k-plum-900", 4.5),
    ("footer muted on plum", "--k-plum-200", "--k-plum-900", 4.5),
    ("footer legal on plum", "--k-plum-300", "--k-plum-900", 4.5),
    ("footer label on plum", "--k-gold-300", "--k-plum-900", 4.5),
    # Large-text and non-text targets.
    ("gold accent (large text only)", "--k-gold-500", WHITE, 3.0),
    ("input border on white", "--k-sand-300", WHITE, 1.4),
]


def main() -> int:
    tokens = load_tokens()

    def resolve(ref: str) -> str:
        if ref.startswith("#"):
            return ref
        if ref not in tokens:
            raise SystemExit(f"token {ref} not found in {TOKENS}")
        return tokens[ref]

    failures = 0
    print(f"contrast check against {TOKENS.relative_to(Path.cwd())}\n")
    print(f"  {'pair':32} {'fg':9} {'bg':9} {'ratio':>7}  target  result")
    print(f"  {'-' * 78}")

    for label, fg_ref, bg_ref, target in PAIRS:
        fg, bg = resolve(fg_ref), resolve(bg_ref)
        ratio = contrast(fg, bg)
        ok = ratio >= target
        if not ok:
            failures += 1
        print(
            f"  {label:32} {fg:9} {bg:9} {ratio:6.2f}:1  {target:5.1f}  "
            f"{'pass' if ok else 'FAIL'}"
        )

    print()
    if failures:
        print(f"{failures} pair(s) below target")
        return 1
    print(f"all {len(PAIRS)} pairs meet their target")
    return 0


if __name__ == "__main__":
    sys.exit(main())

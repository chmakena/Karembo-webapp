import Link from "next/link";

import { Mail, MapPin, Phone } from "./icons";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-plum-900 text-plum-100">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight text-white">
              Karembo
              <span aria-hidden className="size-1.5 rounded-full bg-gold-400" />
            </div>
            <p className="mt-3 max-w-[26ch] text-sm text-plum-200">
              A salon on Nyali Road, Mombasa. Protective styling, nails and skin,
              by appointment.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-gold-300">
              Visit
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-plum-200">
              <li className="flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0" />
                14 Nyali Road, Mombasa
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0" />
                <a href="tel:+254700000000" className="hover:text-white">
                  +254 700 000 000
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0" />
                <a href="mailto:hello@karembo.co.ke" className="hover:text-white">
                  hello@karembo.co.ke
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-gold-300">
              Opening hours
            </h2>
            {/* Mirrors the seeded working hours in the database. */}
            <ul className="mt-3 space-y-1 text-sm text-plum-200 numeric">
              <li>Tue–Fri&nbsp;&nbsp;09:00–18:00</li>
              <li>Saturday&nbsp;&nbsp;08:00–17:00</li>
              <li>Sun &amp; Mon&nbsp;&nbsp;Closed</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-gold-300">
              Book
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <Link href="/services" className="text-plum-100 hover:text-white">
                  All services
                </Link>
              </li>
              <li>
                <Link href="/book" className="text-plum-100 hover:text-white">
                  Make a booking
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="text-plum-100 hover:text-white">
                  My bookings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-sm text-plum-300">
          Karembo salon booking. All times shown in East Africa Time (UTC+3).
        </p>
      </div>
    </footer>
  );
}

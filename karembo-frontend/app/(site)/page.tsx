import Link from "next/link";

import { ArrowRight, Calendar, CheckCircle2, MapPin, Scissors, User } from "@/components/icons";
import { ButtonLink, Container } from "@/components/ui";
import { ServiceGrid } from "@/components/service-grid";
import { StaffList } from "@/components/staff-list";

const STEPS = [
  {
    icon: Scissors,
    title: "Pick a service",
    body: "Browse the menu with real durations and prices — no surprises at the till.",
  },
  {
    icon: User,
    title: "Choose your stylist",
    body: "See who does what, and book the person you trust with your hair.",
  },
  {
    icon: Calendar,
    title: "Take a real slot",
    body: "Times shown are genuinely free. The slot is held the moment you confirm.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="overflow-hidden bg-linear-160 from-plum-900 via-plum-700 to-plum-600 text-white">
        <Container className="py-20 sm:py-24">
          <div className="max-w-[60ch]">
            <span className="inline-flex items-center gap-1 rounded-full border border-gold-200 bg-gold-50 px-3 py-0.5 text-2xs font-semibold uppercase tracking-[0.08em] text-gold-700">
              <MapPin className="size-3" />
              Nyali Road, Mombasa
            </span>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Your chair is
              <br />
              already waiting.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-plum-100">
              Karembo is a salon for protective styling, nails and skin. Pick a
              service, pick your stylist, and take a time that is genuinely free
              — booked in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/book"
                size="lg"
                className="bg-white text-plum-700 hover:bg-plum-50"
              >
                Book an appointment
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink
                href="/services"
                size="lg"
                variant="ghost"
                className="border border-white/35 text-white hover:bg-white/10 hover:text-white"
              >
                See the full menu
              </ButtonLink>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-plum-100">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Free cancellation up to 12h before
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Five stylists, fourteen services
              </span>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl">Three steps, no phone call</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="text-center">
              <span className="mx-auto flex size-18 items-center justify-center rounded-full bg-plum-600 text-white">
                <Icon className="size-7" />
              </span>
              <h3 className="mt-4 text-xl">{title}</h3>
              <p className="mt-2 text-sm text-sand-600">{body}</p>
            </div>
          ))}
        </div>
      </Container>

      <section className="bg-sand-100">
        <Container className="py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The menu</p>
              <h2 className="mt-2 text-3xl">A few of our services</h2>
            </div>
            <ButtonLink href="/services" variant="secondary">
              All services
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
          {/* Limited to three; the full catalogue lives on /services. */}
          <div className="mt-8">
            <ServiceGrid limit={3} />
          </div>
        </Container>
      </section>

      <Container className="py-16">
        <p className="eyebrow">The team</p>
        <h2 className="mt-2 text-3xl">Who you&rsquo;ll be sitting with</h2>
        <div className="mt-8">
          <StaffList />
        </div>
      </Container>

      <section className="bg-plum-50">
        <Container className="py-16 text-center">
          <h2 className="text-3xl">Ready when you are</h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-sand-600">
            Booking takes about a minute, and you can move or cancel it yourself
            up to twelve hours before.
          </p>
          <ButtonLink href="/book" size="lg" className="mt-8">
            Book an appointment
            <ArrowRight className="size-4" />
          </ButtonLink>
          <p className="mt-6 text-sm text-sand-600">
            Prefer to talk to someone?{" "}
            <Link href="tel:+254700000000" className="text-plum-700 underline">
              +254 700 000 000
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}

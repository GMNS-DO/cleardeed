import Link from "next/link";
import Image from "next/image";
import { BhulekhInputForm } from "@/components/BhulekhInputForm";

const steps = [
  {
    label: "Enter plot details",
    copy: "Enter district, tehsil, village, and plot or khatiyan number so ClearDeed can fetch the matching public records.",
  },
  {
    label: "Pay ₹1",
    copy: "Click Get report to open Razorpay. After successful payment, the report is generated automatically.",
  },
  {
    label: "View and download",
    copy: "The report appears on this page, includes a download option, and a copy is sent to your email.",
  },
];

const whatWeCheck = [
  "Bhulekh RoR — owners, area, Kisam, Satwa",
  "Back Page — mutation history, encumbrance entries",
  "Land classification — agricultural, buildable, or prohibited",
  "Conversion requirements and CLU fee estimate",
  "Encumbrance Certificate instructions for your tehsil",
  "Subdivided plot and zoning risk flags",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#17231d]">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <div className="text-xl font-bold tracking-normal text-[#163d33]">ClearDeed</div>
        <div className="flex items-center gap-3">
          <Link
            href="/report/demo"
            className="text-sm font-semibold text-[#1d6f5b] hover:underline"
          >
            View sample report
          </Link>
          <Link
            href="/privacy"
            className="text-sm text-[#5b665f] hover:text-[#1d6f5b]"
          >
            Privacy
          </Link>
        </div>
      </nav>

      {/* ── Hero: report order flow ───────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pt-6 pb-10 md:px-8 md:pt-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left: headline + report order */}
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-normal text-[#8a5f1d]">
              Khordha · Odisha
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-normal text-[#13251e] sm:text-5xl lg:text-[3rem]">
              Find out what you&apos;re buying before you pay token money.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#4b5b52]">
              ClearDeed fetches Bhulekh RoR records for your plot and delivers a plain-English property
              intelligence report. No score, no verdict — just facts, gaps, and questions your lawyer
              should answer.
            </p>

            {/* Report order CTA */}
            <div className="mt-6 rounded border border-[#d7dacf] bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-[#17231d]">
                Get your ClearDeed report
              </p>
              <p className="mb-4 text-sm text-[#5b665f]">
                Enter your plot details and email. After payment, the report opens here and a copy is sent to your inbox.
              </p>

              <ReportOrderForm />
            </div>

            <p className="mt-4 text-xs text-[#5b665f]">
              Full report:{" "}
              <strong className="text-[#17231d]">₹1</strong>
              {" "}· Shown instantly after payment · PDF download included
            </p>
          </div>

          {/* Right: social proof + report preview image */}
          <div className="flex flex-col gap-5">
            {/* Report image */}
            <div className="overflow-hidden rounded border border-[#d7dacf] bg-white shadow-sm">
              <div className="relative aspect-[4/3] min-h-[280px]">
                <Image
                  src="/images/plot-verification-hero.png"
                  alt="Sample ClearDeed report showing plot details, owner information, and risk flags"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-[#8a5f1d]">Sample output</p>
                <p className="mt-1 text-sm text-[#5b665f]">
                  Front page of a Bhulekh RoR report. Owner, plot, Kisam, and risk signals visible at a glance.
                </p>
              </div>
            </div>

            {/* Social proof placeholder */}
            <div className="rounded border border-[#d7dacf] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <svg key={n} className="h-4 w-4 fill-[#d4a017]" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-semibold text-[#17231d]">Placeholder</span>
              </div>
              <blockquote className="text-sm italic text-[#4b5b52]">
                &quot;[Testimonial from first real buyer goes here. Photo + locality + consent required.]&quot;
              </blockquote>
              <p className="mt-2 text-xs text-[#5b665f]">
                — [Buyer name], [Locality], [Month Year]
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ──────────────────────────────────────────────── */}
      <div className="border-y border-[#dfe2d9] bg-white py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-5 md:px-8">
          <div className="flex items-center gap-2 text-center">
            <span className="text-2xl font-bold text-[#163d33]">—</span>
            <span className="text-sm text-[#5b665f]">reports generated</span>
          </div>
          <div className="h-4 w-px bg-[#d9ddd4]" />
          <div className="flex items-center gap-2 text-center">
            <span className="text-2xl font-bold text-[#163d33]">₹1</span>
            <span className="text-sm text-[#5b665f]">launch price · no subscription</span>
          </div>
          <div className="h-4 w-px bg-[#d9ddd4]" />
          <div className="flex items-center gap-2 text-center">
            <span className="text-2xl font-bold text-[#163d33]">60</span>
            <span className="text-sm text-[#5b665f]">day report validity</span>
          </div>
          <div className="h-4 w-px bg-[#d9ddd4]" />
          <div className="flex items-center gap-2 text-center">
            <span className="text-2xl font-bold text-[#163d33]">0</span>
            <span className="text-sm text-[#5b665f]">no score, no verdict</span>
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <h2 className="text-2xl font-bold text-[#13251e]">How it works</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.label} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d6f5b] text-sm font-bold text-white">
                {i + 1}
              </div>
              <div>
                <h3 className="font-semibold text-[#17231d]">{step.label}</h3>
                <p className="mt-1 text-sm leading-6 text-[#5b665f]">{step.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What the report checks ───────────────────────────────────────── */}
      <section className="border-y border-[#dfe2d9] bg-white py-10">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-[#13251e]">What the full report checks</h2>
              <p className="mt-3 text-base leading-7 text-[#4b5b52]">
                The ₹1 Standard report includes Bhulekh RoR, land classification,
                financial exposure search, and a structured checklist — all delivered automatically.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {whatWeCheck.map((item) => (
                <div key={item} className="flex items-start gap-2.5 rounded border border-[#d9ddd4] bg-[#fafaf7] px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 fill-[#1d6f5b]" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.707-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm leading-5 text-[#26362f]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust signals ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded border border-[#d9ddd4] bg-white p-5">
            <div className="mb-3 text-2xl">📋</div>
            <h3 className="font-semibold text-[#17231d]">Bhulekh RoR is public record</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">
              We fetch publicly available land records from bhulekh.ori.nic.in. We don&apos;t store
              your plot details beyond the report delivery period. See our{" "}
              <Link href="/privacy" className="text-[#1d6f5b]">Privacy Policy</Link>.
            </p>
          </div>
          <div className="rounded border border-[#d9ddd4] bg-white p-5">
            <div className="mb-3 text-2xl">🔍</div>
            <h3 className="font-semibold text-[#17231d]">Fully automated</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">
              Reports are generated and delivered automatically. No manual review step, no waiting.
              You see the report on-page after payment, with a downloadable copy and email backup.
            </p>
          </div>
          <div className="rounded border border-[#d9ddd4] bg-white p-5">
            <div className="mb-3 text-2xl">⚖️</div>
            <h3 className="font-semibold text-[#17231d]">Not a lawyer&apos;s opinion</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">
              ClearDeed surfaces facts from records. It doesn&apos;t certify ownership, guarantee
              clean title, or replace a lawyer. Every report recommends a legal review.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#dfe2d9] py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-[#5b665f] md:px-8">
          <span className="font-semibold text-[#17231d]">ClearDeed</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-[#1d6f5b]">Privacy Policy</Link>
            <Link href="/terms" className="text-[#1d6f5b]">Terms of Service</Link>
            <a href="mailto:support@cleardeed.in" className="text-[#1d6f5b]">Contact</a>
          </div>
          <span>© 2026 ClearDeed · Bhubaneswar, Odisha</span>
        </div>
      </footer>
    </main>
  );
}

// ── Report order inline form ─────────────────────────────────────────────────

function ReportOrderForm() {
  "use client";
  return (
    <div className="flex flex-col gap-3">
      <BhulekhInputForm />
    </div>
  );
}

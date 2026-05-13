import Image from "next/image";
import Link from "next/link";
import { BhulekhInputForm } from "@/components/BhulekhInputForm";

const checks = [
  "Bhulekh RoR — owner names, plot area, land classification, Kisam",
  "Back Page — mutation history, encumbrance entries, remarks",
  "Land classification: agricultural, NA, prohibited, buildable",
  "Conversion status and CLU requirements",
  "Encumbrance Certificate — manual SRO instructions for your tehsil",
  "Buyer checklist — questions to ask the seller and lawyer",
];

const steps = [
  { label: "Enter plot details", copy: "Select tehsil + village, enter plot/khatiyan number from your documents." },
  { label: "We fetch Bhulekh records", copy: "ClearDeed retrieves the official RoR from bhulekh.ori.nic.in and parses both pages." },
  { label: "You get a reviewed report", copy: "Report delivered on WhatsApp after manual review by our team." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f7f2] text-[#17231d]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-8 md:grid-cols-[1fr_0.88fr] md:px-8 lg:py-12">
        <div className="flex flex-col justify-between gap-8">
          <nav className="flex items-center justify-between">
            <div className="text-xl font-bold tracking-normal text-[#163d33]">ClearDeed</div>
            <Link
              href="/report/demo"
              className="rounded border border-[#b7c0b6] px-3 py-2 text-sm font-semibold text-[#1d6f5b] hover:border-[#1d6f5b]"
            >
              View sample report
            </Link>
          </nav>

          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-normal text-[#8a5f1d]">
              Khordha concierge launch
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-normal text-[#13251e] sm:text-5xl lg:text-6xl">
              Verify a plot before you pay token money.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#4b5b52]">
              ClearDeed fetches your plot's Bhulekh RoR (owners, area, Kisam), back-page mutations, and encumbrance remarks,
              then delivers a plain-English report after manual review.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border-l-4 border-[#1d6f5b] bg-white p-4">
              <div className="text-2xl font-bold">₹499</div>
              <p className="mt-1 text-sm text-[#5b665f]">launch review price for early Khordha reports</p>
            </div>
            <div className="border-l-4 border-[#8a5f1d] bg-white p-4">
              <div className="text-2xl font-bold">1–2 days</div>
              <p className="mt-1 text-sm text-[#5b665f]">target turnaround for concierge-reviewed reports</p>
            </div>
            <div className="border-l-4 border-[#465b73] bg-white p-4">
              <div className="text-2xl font-bold">No verdict</div>
              <p className="mt-1 text-sm text-[#5b665f]">facts, gaps, and questions to verify before transacting</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-[#d7dacf] bg-white shadow-sm">
          <div className="relative aspect-[4/3] min-h-[320px]">
            <Image
              src="/images/plot-verification-hero.png"
              alt="Phone showing a plot verification report beside land records at a property site"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 44vw"
            />
          </div>
          <div className="grid gap-3 p-5">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#8a5f1d]">What the report avoids</p>
            <p className="text-base leading-7 text-[#4b5b52]">
              No score, no green-light language, and no substitute for a lawyer. Every section says what was found,
              where it came from, and what still needs manual verification.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#dfe2d9] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[0.95fr_1.05fr] md:px-8">
          <div>
            <h2 className="text-2xl font-bold text-[#13251e]">Request a Bhulekh RoR report</h2>
            <p className="mt-3 leading-7 text-[#4b5b52]">
              Enter your tehsil, village, and plot or khatiyan number from your documents.
              We fetch the official Bhulekh records and deliver a reviewed report on WhatsApp.
            </p>
            <div className="mt-6 grid gap-4">
              {steps.map((step, index) => (
                <div key={step.label} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#e8efe9] text-sm font-bold text-[#1d6f5b]">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#17231d]">{step.label}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#5b665f]">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <BhulekhInputForm />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-8">
        <div>
          <h2 className="text-2xl font-bold text-[#13251e]">What we fetch from Bhulekh</h2>
          <p className="mt-3 leading-7 text-[#4b5b52]">
            Bhulekh RoR records are the official revenue records maintained by the Tahsildar's office.
            The report surfaces the Front Page (owner + plot table) and Back Page (mutation history + remarks).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {checks.map((check) => (
            <div key={check} className="rounded border border-[#d9ddd4] bg-white p-4">
              <p className="text-sm font-semibold leading-6 text-[#26362f]">{check}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

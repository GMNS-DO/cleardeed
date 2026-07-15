/**
 * Seed the `lawyers` table with two Khordha-area panel advocates for the
 * Guaranteed-tier co-sign flow.
 *
 * Run: `pnpm tsx scripts/seed/lawyers.ts`
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

interface SeedLawyer {
  name: string;
  firm: string;
  email: string;
  phone: string;
  license_number: string;
  is_panel: boolean;
}

const PANEL: SeedLawyer[] = [
  {
    name: "Adv. Sasmita Mohanty",
    firm: "Mohanty & Associates",
    email: "sasmita@mohanty-adv.in",
    phone: "+91 98765 43210",
    license_number: "OD/2008/4512",
    is_panel: true,
  },
  {
    name: "Adv. Rakesh Pradhan",
    firm: "Pradhan Legal Chambers",
    email: "rakesh@pradhan-legal.in",
    phone: "+91 98270 11234",
    license_number: "OD/2011/7893",
    is_panel: true,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let inserted = 0;
  let skipped = 0;

  for (const lawyer of PANEL) {
    const { data: existing } = await supabase
      .from("lawyers")
      .select("id")
      .eq("email", lawyer.email)
      .maybeSingle();

    if (existing) {
      console.log(`Skip (already exists): ${lawyer.name} <${lawyer.email}>`);
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("lawyers").insert(lawyer);
    if (error) {
      console.error(`Failed to insert ${lawyer.name}: ${error.message}`);
      process.exit(1);
    }
    console.log(`Inserted: ${lawyer.name} (${lawyer.firm})`);
    inserted += 1;
  }

  console.log(`Done. Inserted ${inserted}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

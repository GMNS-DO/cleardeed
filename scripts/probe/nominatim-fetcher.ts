/**
 * scripts/probe/nominatim-fetcher.ts
 * End-to-end: call nominatimFetch for P051 + a second coordinate, and check
 * the validated output against Khordha/Odisha ground truth.
 */
import { nominatimFetch } from "../../packages/fetchers/nominatim/src/index.ts";

async function probe(label: string, lat: number, lon: number) {
  console.log(`\n=== ${label} ===`);
  console.log(`GPS: ${lat},${lon}`);
  const t0 = Date.now();
  const r = await nominatimFetch({ gps: { lat, lon } });
  const elapsed = Date.now() - t0;
  console.log(`status=${r.status} verification=${r.verification} reason=${r.statusReason} elapsed=${elapsed}ms`);
  console.log(`attempts=${r.attempts ?? "n/a"}`);
  console.log(`data:`, JSON.stringify(r.data, null, 2));
  console.log(`validators:`);
  for (const v of r.validators ?? []) {
    console.log(`  [${v.status}] ${v.name}: ${v.message}`);
  }
}

await probe("P051 Mendhasala (Khordha, Odisha)", 20.272688, 85.701271);
await probe("Bhubaneswar center", 20.2961, 85.8245);
await probe("Cuttack (wrong district — manual_required)", 20.4625, 85.8830);

/**
 * scripts/probe/nominatim-live.ts
 * Probe Nominatim reverse geocode for P051 (Mendhasala, Khordha).
 */
const UA = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const P051 = { lat: 20.272688, lon: 85.701271 };

async function probe(label: string, lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  console.log(`\n=== ${label} ===`);
  console.log(`URL: ${url}`);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
    const elapsed = Date.now() - t0;
    console.log(`status=${r.status} elapsed=${elapsed}ms`);
    if (r.ok) {
      const j = await r.json();
      console.log(`display_name: ${j.display_name}`);
      console.log(`address:`, JSON.stringify(j.address, null, 2));
    } else {
      console.log(`body: ${(await r.text()).slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

await probe("P051 Mendhasala", P051.lat, P051.lon);
await probe("Bhubaneswar center", 20.2961, 85.8245);

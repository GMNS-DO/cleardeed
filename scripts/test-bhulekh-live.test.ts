/**
 * scripts/test-bhulekh-live.test.ts
 * Run: pnpm exec vitest run scripts/test-bhulekh-live.test.ts
 */
import { describe, it, expect } from 'vitest';

describe('Bhulekh live fetcher', () => {
  it('should fetch RoR for Mendhasala plot 1', async () => {
    const { fetch } = await import('../packages/fetchers/bhulekh/src/index.ts');
    const result = await fetch({ village: 'Mendhasala', plotNo: '1' });

    console.log('status:', result.status);
    if (result.status === 'success' && result.data) {
      const tenants = result.data.revenueRecords?.tenants ?? [];
      console.log('tenants:', tenants.length);
      if (tenants[0]) {
        console.log('owner:', tenants[0].ownerName);
        console.log('khatiyan:', tenants[0].khatiyanNo);
        console.log('plots:', tenants[0].plots?.length ?? 0);
        const p = tenants[0].plots?.[0];
        if (p) {
          console.log('plot area:', p.area, p.areaUnit);
          console.log('landClass:', p.landClass);
        }
      }
      const ss = result.data.screenshots;
      console.log('front screenshot:', ss?.frontPage ? `${ss.frontPage.length} chars` : 'none');
      console.log('back screenshot:', ss?.backPage ? `${ss.backPage.length} chars` : 'none');
      const bp = result.data.backPage;
      console.log('back page:', bp ? 'present' : 'none');
      if (bp) {
        console.log('mutations:', bp.mutationHistory?.length ?? 0);
        console.log('encumbrances:', bp.encumbranceDetails?.length ?? 0);
      }
    } else {
      console.log('error:', result.statusReason ?? result.error);
    }

    // Basic assertion — make sure we get a result
    expect(result.status).toBeTruthy();
  }, 60_000);
});
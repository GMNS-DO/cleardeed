/** @type {import('next').NextConfig} */
const path = require("path");
const webpack = require("webpack");
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright",
    "playwright-core",
    "@cleardeed/fetcher-bhulekh",
    "@cleardeed/fetcher-ecourts",
    "@cleardeed/fetcher-igr-ec",
    "@cleardeed/fetcher-cersai",
    "@cleardeed/fetcher-rccms",
    "@cleardeed/fetcher-bhunaksha-plot-report",
  ],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/api/report/create": [
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**/*",
      "../../node_modules/@sparticuz/chromium/bin/**/*",
    ],
    "/api/report/[id]/pdf": [
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**/*",
      "../../node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
  transpilePackages: [
    "@cleardeed/schema",
    "@cleardeed/fetcher-nominatim",
    "@cleardeed/fetcher-high-court",
    "@cleardeed/fetcher-drt",
    "@cleardeed/fetcher-bhunaksha",
    "@cleardeed/orchestrator",
    "@cleardeed/pdf-renderer",
    "@cleardeed/consumer-report-writer",
    "@cleardeed/ownership-reasoner",
    "@cleardeed/output-auditor",
    "@cleardeed/land-classifier",
    "@cleardeed/encumbrance-reasoner",
    "@cleardeed/regulatory-screener",
    "@cleardeed/fetcher-public-dashboard",
    "@cleardeed/fetcher-govt-fee",
    "@cleardeed/fetcher-igr-certified-copy",
    "@cleardeed/fetcher-bhuvan-flood",
  ],
  webpack: (config: { resolve: { alias: Record<string, string> } }) => {
    // Playwright-using fetcher packages are externalized via serverExternalPackages above,
    // so their node_modules path is used at runtime. Non-Playwright packages still need
    // source aliases so webpack bundles them correctly from the monorepo sources.
    config.resolve.alias = {
      ...config.resolve.alias,
      // Non-playwright packages — must alias to source files for webpack to bundle them
      "@cleardeed/schema": path.resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@cleardeed/fetcher-nominatim": path.resolve(__dirname, "../../packages/fetchers/nominatim/src/index.ts"),
      "@cleardeed/fetcher-bhunaksha": path.resolve(__dirname, "../../packages/fetchers/bhunaksha/src/index.ts"),
      "@cleardeed/orchestrator": path.resolve(__dirname, "../../packages/orchestrator/src/index.ts"),
      "@cleardeed/consumer-report-writer": path.resolve(__dirname, "../../agents/consumer-report-writer/src/index.ts"),
      "@cleardeed/consumer-report-writer/fixtures/golden-path": path.resolve(__dirname, "../../agents/consumer-report-writer/fixtures/golden-path.ts"),
      "@cleardeed/ownership-reasoner": path.resolve(__dirname, "../../agents/ownership-reasoner/index.ts"),
      "@cleardeed/output-auditor": path.resolve(__dirname, "../../agents/output-auditor/src/index.ts"),
      "@cleardeed/land-classifier": path.resolve(__dirname, "../../agents/land-classifier/index.ts"),
      "@cleardeed/encumbrance-reasoner": path.resolve(__dirname, "../../agents/encumbrance-reasoner/index.ts"),
      "@cleardeed/regulatory-screener": path.resolve(__dirname, "../../agents/regulatory-screener/index.ts"),
      "@cleardeed/pdf-renderer": path.resolve(__dirname, "../../packages/pdf-renderer/index.ts"),
      "@cleardeed/fetcher-public-dashboard": path.resolve(__dirname, "../../packages/fetchers/public-dashboard/src/index.ts"),
      "@cleardeed/fetcher-govt-fee": path.resolve(__dirname, "../../packages/fetchers/govt-fee/src/index.ts"),
      "@cleardeed/fetcher-igr-certified-copy": path.resolve(__dirname, "../../packages/fetchers/igr-certified-copy/src/index.ts"),
      "@cleardeed/fetcher-bhuvan-flood": path.resolve(__dirname, "../../packages/fetchers/bhuvan-flood/src/index.ts"),
      // Playwright-using packages — DO NOT alias to source; let webpack use node_modules path
      // (serverExternalPackages above ensures they're not bundled and loaded at runtime instead)
      // Note: TypeScript will resolve via tsconfig paths, so imports still work.
    };

    // Explicitly externalize playwright packages so webpack doesn't try to parse them
    // This overrides any resolution and prevents the vite/recorder HTML parse failure
    const pwExternal = (context, request, callback) => {
      if (
        request === "playwright" ||
        request === "playwright-core" ||
        request === "tesseract.js" ||
        request === "@sparticuz/chromium" ||
        request === "@sparticuz/chromium-linux-x64"
      ) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!config.externals) config.externals = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (config.externals as unknown[]).push(pwExternal);

    return config;
  },
};

export default nextConfig;
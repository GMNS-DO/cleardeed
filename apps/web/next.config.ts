/** @type {import('next').NextConfig} */
const path = require("path");
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@sparticuz/chromium"],
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
    "@cleardeed/fetcher-bhulekh",
    "@cleardeed/fetcher-high-court",
    "@cleardeed/fetcher-drt",
    "@cleardeed/fetcher-bhunaksha",
    "@cleardeed/fetcher-ecourts",
    "@cleardeed/fetcher-rccms",
    "@cleardeed/fetcher-igr-ec",
    "@cleardeed/fetcher-cersai",
    "@cleardeed/orchestrator",
    "@cleardeed/pdf-renderer",
    "@cleardeed/consumer-report-writer",
    "@cleardeed/ownership-reasoner",
    "@cleardeed/output-auditor",
    "@cleardeed/land-classifier",
    "@cleardeed/encumbrance-reasoner",
    "@cleardeed/regulatory-screener",
  ],
  webpack: (config: { resolve: { alias: Record<string, string> } }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@cleardeed/schema": path.resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@cleardeed/fetcher-nominatim": path.resolve(__dirname, "../../packages/fetchers/nominatim/src/index.ts"),
      "@cleardeed/fetcher-bhulekh": path.resolve(__dirname, "../../packages/fetchers/bhulekh/src/index.ts"),
      "@cleardeed/fetcher-high-court": path.resolve(__dirname, "../../packages/fetchers/high-court/src/index.ts"),
      "@cleardeed/fetcher-drt": path.resolve(__dirname, "../../packages/fetchers/drt/src/index.ts"),
      "@cleardeed/fetcher-bhunaksha": path.resolve(__dirname, "../../packages/fetchers/bhunaksha/src/index.ts"),
      "@cleardeed/fetcher-ecourts": path.resolve(__dirname, "../../packages/fetchers/ecourts/src/index.ts"),
      "@cleardeed/orchestrator": path.resolve(__dirname, "../../packages/orchestrator/src/index.ts"),
      "@cleardeed/consumer-report-writer": path.resolve(__dirname, "../../agents/consumer-report-writer/src/index.ts"),
      "@cleardeed/consumer-report-writer/fixtures/golden-path": path.resolve(__dirname, "../../agents/consumer-report-writer/fixtures/golden-path.ts"),
      "@cleardeed/ownership-reasoner": path.resolve(__dirname, "../../agents/ownership-reasoner/index.ts"),
      "@cleardeed/output-auditor": path.resolve(__dirname, "../../agents/output-auditor/src/index.ts"),
      "@cleardeed/land-classifier": path.resolve(__dirname, "../../agents/land-classifier/index.ts"),
      "@cleardeed/fetcher-rccms": path.resolve(__dirname, "../../packages/fetchers/rccms/src/index.ts"),
      "@cleardeed/fetcher-igr-ec": path.resolve(__dirname, "../../packages/fetchers/igr-ec/src/index.ts"),
      "@cleardeed/fetcher-cersai": path.resolve(__dirname, "../../packages/fetchers/cersai/src/index.ts"),
      "@cleardeed/encumbrance-reasoner": path.resolve(__dirname, "../../agents/encumbrance-reasoner/index.ts"),
      "@cleardeed/regulatory-screener": path.resolve(__dirname, "../../agents/regulatory-screener/index.ts"),
      "@cleardeed/pdf-renderer": path.resolve(__dirname, "../../packages/pdf-renderer/index.ts"),
    };
    return config;
  },
};

export default nextConfig;

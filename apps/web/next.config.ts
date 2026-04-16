/** @type {import('next').NextConfig} */
const path = require("path");
const nextConfig = {
  transpilePackages: [
    "@cleardeed/schema",
    "@cleardeed/fetcher-nominatim",
    "@cleardeed/fetcher-bhulekh",
    "@cleardeed/orchestrator",
    "@cleardeed/pdf-renderer",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@cleardeed/schema": path.resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@cleardeed/fetcher-nominatim": path.resolve(__dirname, "../../packages/fetchers/nominatim/src/index.ts"),
      "@cleardeed/fetcher-bhulekh": path.resolve(__dirname, "../../packages/fetchers/bhulekh/src/index.ts"),
      "@cleardeed/orchestrator": path.resolve(__dirname, "../../packages/orchestrator/src/index.ts"),
      "@cleardeed/pdf-renderer": path.resolve(__dirname, "../../packages/pdf-renderer/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
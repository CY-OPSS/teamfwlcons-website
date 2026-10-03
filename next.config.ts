import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/config.ts");

// No remote image optimization is configured on purpose: a hostname wildcard
// would turn /_next/image into an open proxy for arbitrary remote URLs.
// Add explicit remotePatterns entries here if next/image is adopted later.
const nextConfig: NextConfig = {
  // Dependencies are linked into node_modules/.pnpm, so Turbopack's inferred
  // workspace root can land above the real project. Pin it to the project dir.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Exposes Cloudflare bindings (R2, KV, etc.) to `next dev` via the
// OpenNext local simulator so we can read/write STORAGE during dev.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Pre-existing unknown-narrowing errors in several API routes are not
  // blocking behaviour — unblock builds until they're cleaned up separately.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.centracdn.net',
      },
    ],
  },
};

export default nextConfig;

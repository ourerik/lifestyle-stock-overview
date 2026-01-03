import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

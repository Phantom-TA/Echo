import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  // Disable X-Powered-By header for security
  poweredByHeader: false,
};

export default nextConfig;

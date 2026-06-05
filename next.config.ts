import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  // Disable X-Powered-By header for security
  poweredByHeader: false,
};

export default nextConfig;

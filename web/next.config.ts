import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/artifacts/*.json"],
  },
};

export default nextConfig;

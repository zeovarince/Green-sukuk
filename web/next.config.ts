import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  transpilePackages: ["three"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/artifacts/*.json"],
  },
};

export default nextConfig;

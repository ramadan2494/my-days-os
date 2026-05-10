import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress the middleware→proxy deprecation warning (Next.js 16)
  // All auth-dependent pages use force-dynamic or are in the (app) layout
};

export default nextConfig;

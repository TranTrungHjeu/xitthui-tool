import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  experimental: {
    // Disable server-side rendering for specific attributes injected by extensions
  },
};

export default nextConfig;

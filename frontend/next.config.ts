import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  experimental: {
    // Disable server-side rendering for specific attributes injected by extensions
    serverComponentsExternalPackages: ["@google-cloud/vertexai"], // Example for external packages
    turbo: {
      resolve: {
        // Explicitly set up aliases for Turbopack
        alias: {
          "@": path.resolve(__dirname, "./src"),
          "@/components": path.resolve(__dirname, "./src/components"),
          "@/lib": path.resolve(__dirname, "./src/lib"),
          "@/services": path.resolve(__dirname, "./src/services"),
          "@/store": path.resolve(__dirname, "./src/store"),
          "@/types": path.resolve(__dirname, "./src/types"),
        },
      },
    },
  },
};

export default nextConfig;

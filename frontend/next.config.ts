import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

const rootEnvPath = path.resolve(process.cwd(), "../.env");
if (fs.existsSync(rootEnvPath)) {
  const envContent = fs.readFileSync(rootEnvPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmedLine = line.trim();
    if (
      trimmedLine &&
      !trimmedLine.startsWith("#") &&
      trimmedLine.includes("=")
    ) {
      const [key, ...valueParts] = trimmedLine.split("=");
      const value = valueParts
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (key.startsWith("NEXT_PUBLIC_")) {
        process.env[key] = value;
      }
    }
  });
}

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  allowedDevOrigins: ["192.168.1.3"],
};

export default nextConfig;

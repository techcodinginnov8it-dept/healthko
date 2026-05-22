import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.254.122"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

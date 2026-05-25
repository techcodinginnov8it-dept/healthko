import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.254.122",
    "loose-months-retire.loca.lt",
    "*.loca.lt",
    "farmer-celebrities-pond-binding.trycloudflare.com",
    "*.trycloudflare.com",
    "*.ngrok-free.dev",
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

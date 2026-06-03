import type { NextConfig } from "next";

const localNetworkHosts = ["192.168.254.122", "192.168.1.19"];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    ...localNetworkHosts,
    "loose-months-retire.loca.lt",
    "*.loca.lt",
    "farmer-celebrities-pond-binding.trycloudflare.com",
    "*.trycloudflare.com",
    "*.ngrok-free.dev",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        ...localNetworkHosts.flatMap((host) => [`${host}:3000`, `${host}:3443`]),
        "loose-months-retire.loca.lt",
        "*.loca.lt",
        "farmer-celebrities-pond-binding.trycloudflare.com",
        "*.trycloudflare.com",
        "*.ngrok-free.dev",
      ],
    },
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

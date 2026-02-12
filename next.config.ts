import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "fb002246-3000.asse.devtunnels.ms",
        "https://fb002246-3000.asse.devtunnels.ms",
        "localhost:3000"
      ],
    },
  },
};

export default nextConfig;

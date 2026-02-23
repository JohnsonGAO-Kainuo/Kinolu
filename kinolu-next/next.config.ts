import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Proxy all /api/* requests to the Python backend so the user
  // only ever needs to open localhost:3000.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;

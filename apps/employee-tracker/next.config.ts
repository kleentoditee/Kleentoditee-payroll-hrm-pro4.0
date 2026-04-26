import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        source: "/__kleentoditee_api/:path*",
        destination: "http://127.0.0.1:8787/:path*"
      }
    ];
  }
};

export default nextConfig;

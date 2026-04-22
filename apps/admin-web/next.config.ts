import type { NextConfig } from "next";

// In `next dev`, send browser traffic to the API through this origin so fetches are same-origin
// (avoids CORS and false "Cannot talk to the API" when the admin is opened on 127.0.0.1 or a LAN IP).
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

import type { NextConfig } from "next";

const apiProxyTarget =
  process.env.API_PROXY_TARGET?.replace(/\/$/, "") ||
  (process.env.API_HOSTPORT ? `http://${process.env.API_HOSTPORT}` : "") ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8787" : "");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'"
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    if (!apiProxyTarget) {
      return [];
    }
    return [
      {
        source: "/__kleentoditee_api/:path*",
        destination: `${apiProxyTarget}/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy }
        ]
      }
    ];
  }
};

export default nextConfig;

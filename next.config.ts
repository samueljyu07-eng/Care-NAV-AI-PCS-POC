import type { NextConfig } from "next";

// Who may show the /embed pages inside an iframe: this app, the portfolio site, and local dev.
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  "https://sam-yu-personal-websitevercelapp.vercel.app",
  "https://samuelyu.com",
  "https://www.samuelyu.com",
  "http://localhost:*",
  "http://127.0.0.1:*",
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors ${EMBED_FRAME_ANCESTORS.join(" ")}` }],
      },
    ];
  },
  /* config options here */
  // 127.0.0.1 is not treated as localhost. Allow it so the page can connect.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

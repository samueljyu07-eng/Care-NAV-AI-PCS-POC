import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

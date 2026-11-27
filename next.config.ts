import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build (NEXT_DIST_DIR=.next-verify) run while `next dev` uses .next,
  // without the two overwriting each other's output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

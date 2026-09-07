import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent CDNs and edge proxies from caching HTML documents with outdated chunk hashes
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|css|js)).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Surrogate-Control",
            value: "no-store",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
  // Ensure requests for stale cached chunk hashes gracefully resolve to our fallback styles
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/_next/static/chunks/0amn85h-74b_f.css",
          destination: "/fallback.css",
        },
      ],
    };
  },
};

export default nextConfig;

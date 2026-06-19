import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  basePath: "/marketplace",
  rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/marketplace/:path*",
          destination: "http://localhost:8001/api/marketplace/:path*",
          basePath: false,
        },
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
          basePath: false,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;

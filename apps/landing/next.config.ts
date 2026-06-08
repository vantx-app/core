import type { NextConfig } from "next";

const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

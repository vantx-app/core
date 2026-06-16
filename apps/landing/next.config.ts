import type { NextConfig } from "next";

const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  transpilePackages: ["@vantx/ui", "@vantx/auth"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@vantx/ui"],
  },
  async rewrites() {
    const rewritesList = [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];

    if (process.env.NODE_ENV !== "production") {
      rewritesList.push({
        source: "/marketplace/:path*",
        destination: "http://localhost:3002/marketplace/:path*",
      });
    }

    return rewritesList;
  },
};

export default nextConfig;

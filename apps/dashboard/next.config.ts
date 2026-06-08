import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/socket.io/:path*",
          destination: "http://localhost:8000/api/socket.io/:path*",
        },
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ];
    }

    return [];
  },
  async redirects() {
    return [
      {
        // Evita bucles de redirección limitando el ID a un solo segmento (sin barras /)
        source: "/vehicle/:id((?!new$)[^/]+)",
        destination: "/vehicle/:id/view",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

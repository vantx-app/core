import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  basePath: "/dashboard",
  rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/socket.io/:path*",
          destination: "http://localhost:8000/api/socket.io/:path*",
          basePath: false,
        },
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
          basePath: false,
        },
        {
          source: "/marketplace/:path*",
          destination: "http://localhost:3002/marketplace/:path*",
          basePath: false,
        },
      ];
    }

    return [];
  },
  async redirects() {
    const isDev = process.env.NODE_ENV === "development";

    return [
      ...(isDev
        ? [
            {
              source: "/",
              destination: "/dashboard",
              basePath: false as const,
              permanent: false,
            },
          ]
        : []),
      {
        source: "/sw.js",
        destination: "/dashboard/sw.js",
        basePath: false as const,
        permanent: false,
      },
      {
        // Evita bucles de redirección limitando el ID a un solo segmento (sin barras /)
        source: "/vehicle/:id((?!new$)[^/]+)",
        destination: "/vehicle/:id/view",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default 1MB ist zu klein für Handyfotos (Armband-/Perlenfotos,
      // Bestelllisten-Screenshots), die als Server Action hochgeladen werden.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

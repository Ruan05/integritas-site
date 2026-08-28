import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The cloud runtime supplies an image-transform binding in production.
  // Development previews serve the checked-in assets directly so branding
  // never depends on a binding that is intentionally absent locally.
  images: {
    unoptimized: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;

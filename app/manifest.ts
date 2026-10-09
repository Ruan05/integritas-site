import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Integritas",
    short_name: "Integritas",
    description: "Integrity in every cross-border decision.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      {
        src: "/brand/integritas-scales-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/integritas-scales-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

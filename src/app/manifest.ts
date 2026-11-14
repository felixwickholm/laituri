import type { MetadataRoute } from "next";

/** The installable app: the brand kit's rounded ink tiles, the warm page ground. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Laituri: the dock for AI agents",
    short_name: "Laituri",
    description: "Fixed prices, your limits, proof on every order.",
    start_url: "/buyer",
    display: "standalone",
    background_color: "#f2f7f8",
    theme_color: "#f2f7f8",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

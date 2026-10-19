import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Margem — rotina flexível",
    short_name: "Margem",
    description: "Quanto cabe no seu dia, quanto já foi feito e quanto ainda sobra.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

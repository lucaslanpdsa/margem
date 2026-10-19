import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Margem — rotina flexível",
    short_name: "Margem",
    description: "Quanto cabe no seu dia, quanto já foi feito e quanto ainda sobra.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#f5f5f4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comunicate — Chat Híbrido y Comunidades",
    short_name: "Comunicate",
    description:
      "Mensajería instantánea estilo Telegram/WhatsApp por número o correo + servidores y canales estilo Discord.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d14",
    theme_color: "#6366f1",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAIN//GRID - Replay Islamabad's storms on your roof",
  description:
    "Pick your roof in Islamabad, replay a real recorded storm, and see where every litre went: tank, ground or drain. Then bring your street.",
  openGraph: {
    title: "RAIN//GRID",
    description: "Replay Islamabad's real monsoon storms on your own roof and see where every litre goes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}

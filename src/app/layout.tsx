import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: "RAIN//GRID - Replay Islamabad's storms on your roof",
  description:
    "Pick your roof in Islamabad, replay a real recorded storm, and see where every litre was stored, routed toward recharge, or drained. Then bring your street.",
  openGraph: {
    title: "RAIN//GRID",
    description: "Replay Islamabad's real monsoon storms on your own roof and see where every litre goes.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf3f8" },
    { media: "(prefers-color-scheme: dark)", color: "#06202c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before first paint by THEME_SCRIPT (stored choice,
    // else the system preference); React keeps what the script wrote.
    <html lang="en" data-theme="light" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}

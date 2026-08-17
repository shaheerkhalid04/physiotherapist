import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glide",
  description:
    "Remote post-operative hand and upper limb rehabilitation, prescribed and monitored by your hospital hand team.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Glide", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom is never disabled. A patient who needs to magnify the screen must be able to.
  maximumScale: 5,
  themeColor: "#f7f8fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PulseProbe — Distributed API Uptime & Latency Beacon",
  description: "Real-time API uptime monitoring, latency tracking, and incident status beacon",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}

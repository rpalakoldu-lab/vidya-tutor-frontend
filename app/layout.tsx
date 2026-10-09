import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vidya - AI Video Tutor",
  description: "Sub-second latency AI Video Tutor for engineering students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-white">
        {children}
      </body>
    </html>
  );
}

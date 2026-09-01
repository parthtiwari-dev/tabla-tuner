import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tabla Tuner",
  description:
    "A tuner that measures whether a dayan is tuned evenly all the way around, not just at one spot.",
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
  // The drum is in your lap and the phone is propped up; pinch-zoom is a
  // legitimate way to read the screen at an angle.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

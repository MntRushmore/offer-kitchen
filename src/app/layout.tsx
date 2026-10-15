import type { Metadata, Viewport } from "next";
import { Bagel_Fat_One, Caveat_Brush, Host_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const host = Host_Grotesk({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-host" });
const bagel = Bagel_Fat_One({ subsets: ["latin"], weight: "400", variable: "--font-bagel" });
const caveat = Caveat_Brush({ subsets: ["latin"], weight: "400", variable: "--font-caveat" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono-ticket" });

export const metadata: Metadata = {
  title: "Offer Kitchen",
  description: "Cook up an offer so good people feel stupid saying no.",
  icons: { icon: "/art/avatars/tomato.webp" },
};

export const viewport: Viewport = {
  themeColor: "#efe8db",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Android Chrome: the keyboard shrinks the page instead of covering it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${host.variable} ${bagel.variable} ${caveat.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

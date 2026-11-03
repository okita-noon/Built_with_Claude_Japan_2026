import type { Metadata } from "next";
import { Yuji_Boku, Shippori_Mincho, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const fude = Yuji_Boku({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-fude",
  display: "swap",
});

const mincho = Shippori_Mincho({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-mincho",
  display: "swap",
});

const body = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "筆のこえ",
  description: "母の記憶から土地を一筆ずつ棚卸し、家族と窓口のあいだをつなぐ。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${fude.variable} ${mincho.variable} ${body.variable}`}>
      <body className="washi-ground min-h-screen">{children}</body>
    </html>
  );
}

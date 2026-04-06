import type { Metadata } from "next";
import { Geist, Geist_Mono, Allura } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const allura = Allura({
  variable: "--font-signature",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.kindlewoodstudio.ai'),
  title: "KindleWood Studio",
  description: "Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere",
  openGraph: {
    title: "KindleWood Studio",
    description: "Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere",
    siteName: "KindleWood Studio",
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'KindleWood Studio — Where Imagination Grows into Learning' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "KindleWood Studio",
    description: "Where Imagination Grows into Learning — Read, Listen, and Learn Anywhere",
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${allura.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

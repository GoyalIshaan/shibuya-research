import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Shibuya Consumer Research",
    template: "%s · Shibuya Consumer Research",
  },
  description:
    "AI-powered consumer research and signal intelligence across Reddit, app stores, Product Hunt, and more.",
  applicationName: "Shibuya Consumer Research",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Shibuya Consumer Research",
    description:
      "AI-powered consumer research and signal intelligence across Reddit, app stores, Product Hunt, and more.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shibuya Consumer Research",
    description:
      "AI-powered consumer research and signal intelligence across Reddit, app stores, Product Hunt, and more.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
      >
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-8 h-16 flex items-center justify-between">
            <Link href="/" className="font-bold text-xl tracking-tight text-gray-900 hover:opacity-80 transition-opacity">
              Shibuya
            </Link>
            <div className="flex gap-8 text-sm font-medium text-gray-600">
              <Link href="/research" className="hover:text-gray-900 transition-colors">
                Research
              </Link>
              <Link href="/signals" className="hover:text-gray-900 transition-colors">
                Signals
              </Link>
            </div>
          </div>
        </nav>
        <div className="pt-16 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}

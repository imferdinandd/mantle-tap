// src/app/layout.tsx
import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 0.5,
  maximumScale: 3,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://mantle-tap.vercel.app'),
  title: 'MantleTap — Tap to Trade',
  description: 'The simplest decentralized exchange — tap to trade, open positions, and earn rewards in just one click. Powered by Mantle Network.',
  icons: {
    icon: '/favicon.ico',
    apple: '/mantle-tap-polos.png',
  },
  openGraph: {
    title: 'MantleTap — Tap to Trade',
    description: 'The simplest decentralized exchange — tap to trade, open positions, and earn rewards in just one click.',
    url: 'https://mantletap.xyz',
    siteName: 'MantleTap',
    images: [
      {
        url: '/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'MantleTap — Tap to Trade',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MantleTap — Tap to Trade',
    description: 'The simplest decentralized exchange — tap to trade, open positions, and earn rewards in just one click.',
    images: ['/og-banner.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head></head>
      <body className={plusJakartaSans.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

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

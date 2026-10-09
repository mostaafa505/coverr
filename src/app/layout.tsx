import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'كفر برنت',
  description: 'تصميم وتجهيز ملفات طباعة جرابات الموبايل بالمقاس الحقيقي',
  applicationName: 'كفر برنت',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'كفر برنت', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F1EA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="h-dvh overflow-hidden bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Layers, Printer, Ruler, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ورشة كفر برنت | منضدة تصميم وطباعة كفرات الموبايل بدقة 300 DPI',
  description: 'منظومة إعداد وتجهيز جرابات الموبايل للطباعة والقص الفوري بمعيار PDF/X-4 CMYK ومقاسات دقيقة بالملليمتر',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#F4F2ED] text-[#141413] flex flex-col font-sans antialiased selection:bg-[#141413] selection:text-white">
        {/* Technical Workshop Header */}
        <header className="sticky top-0 z-50 bg-[#FBFBF9] border-b border-[#D4D1C7] h-13 px-4 sm:px-6 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-[#141413] text-[#F4F2ED] flex items-center justify-center font-bold text-sm tracking-tight border border-[#141413]">
                <Printer className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#141413] tracking-tight leading-tight">
                  ورشة كفر برنت <span className="font-mono text-xs font-normal text-[#827F75] mr-1">| استوديو الإنتاج</span>
                </span>
                <span className="text-[10px] text-[#5A5850] font-mono-num">
                  تجهيز ملفات الطباعة والقص الميكانيكي 1:1
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#ECE9E1] border border-[#D4D1C7] text-xs font-mono-num text-[#4F4D46]">
              <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block animate-pulse"></span>
              <span>300 DPI CMYK</span>
              <span className="text-[#A3A096]">|</span>
              <span>PDF/X-4</span>
              <span className="text-[#A3A096]">|</span>
              <span>CUT DIE-LINE</span>
            </div>

            <div className="text-xs text-[#5A5850] px-2.5 py-1 border border-[#D4D1C7] bg-[#FBFBF9] font-mono-num">
              <span className="font-semibold text-[#141413]">397</span> موديل مدعوم
            </div>
          </div>
        </header>

        {/* Workbench Container */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#F4F2ED]">{children}</main>
      </body>
    </html>
  );
}

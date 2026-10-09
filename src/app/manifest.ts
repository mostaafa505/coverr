import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'كفر برنت',
    short_name: 'كفر برنت',
    description: 'تصميم وتجهيز ملفات طباعة جرابات الموبايل',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#F4F1EA',
    theme_color: '#F4F1EA',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}

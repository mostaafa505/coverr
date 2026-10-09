// الخطوط المتاحة داخل التصميم – تُحمَّل من الحزمة نفسها (بدون اتصال بجوجل)
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/700.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/amiri/400.css';
import '@fontsource/amiri/700.css';
import '@fontsource/reem-kufi/400.css';
import '@fontsource/reem-kufi/700.css';
import '@fontsource/lalezar/400.css';
import '@fontsource/el-messiri/400.css';
import '@fontsource/el-messiri/700.css';
import '@fontsource/changa/400.css';
import '@fontsource/changa/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/pacifico/400.css';
import '@fontsource/bebas-neue/400.css';

export interface FontChoice {
  family: string;
  label: string;
  group: 'ar' | 'en';
}

export const FONTS: FontChoice[] = [
  { family: 'Cairo', label: 'القاهرة', group: 'ar' },
  { family: 'Tajawal', label: 'تجوال', group: 'ar' },
  { family: 'Changa', label: 'چانجا', group: 'ar' },
  { family: 'El Messiri', label: 'المسيري', group: 'ar' },
  { family: 'Reem Kufi', label: 'ريم كوفي', group: 'ar' },
  { family: 'Lalezar', label: 'لاليزار', group: 'ar' },
  { family: 'Amiri', label: 'أميري', group: 'ar' },
  { family: 'Inter', label: 'Inter', group: 'en' },
  { family: 'Poppins', label: 'Poppins', group: 'en' },
  { family: 'Playfair Display', label: 'Playfair', group: 'en' },
  { family: 'Bebas Neue', label: 'Bebas Neue', group: 'en' },
  { family: 'Pacifico', label: 'Pacifico', group: 'en' },
];

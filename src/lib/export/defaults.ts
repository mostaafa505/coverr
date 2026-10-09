import type { ExportOptions } from '@/types';

export const OPTION_DEFAULTS: Record<ExportOptions['technology'], Partial<ExportOptions>> = {
  sublimation: { mirror: true, whiteInk: false },
  dtf: { mirror: true, whiteInk: true },
  uv: { mirror: false, whiteInk: true },
};

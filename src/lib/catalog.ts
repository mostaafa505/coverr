import type { Brand, Catalog, DeviceModel, PrintTemplate } from '@/types';

const OVERRIDES_KEY = 'cp.template-overrides.v1';
const CUSTOM_KEY = 'cp.custom-models.v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين ممنوع أو ممتلئ – مش مشكلة */
  }
}

export const CUSTOM_BRAND: Brand = { id: 'custom', name: 'My models', nameAr: 'موديلاتي', os: 'android' };

let cache: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (!cache) {
    cache = fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error('تعذر تحميل قائمة الموديلات');
        return r.json() as Promise<Catalog>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

export function getOverrides(): Record<string, PrintTemplate> {
  return readJson<Record<string, PrintTemplate>>(OVERRIDES_KEY, {});
}

export function saveOverride(modelId: string, template: PrintTemplate | null) {
  const all = getOverrides();
  if (template) all[modelId] = template;
  else delete all[modelId];
  writeJson(OVERRIDES_KEY, all);
}

export function getCustomModels(): DeviceModel[] {
  return readJson<DeviceModel[]>(CUSTOM_KEY, []);
}

export function saveCustomModel(m: DeviceModel) {
  const all = getCustomModels().filter((x) => x.id !== m.id);
  all.unshift(m);
  writeJson(CUSTOM_KEY, all);
}

export function deleteCustomModel(id: string) {
  writeJson(
    CUSTOM_KEY,
    getCustomModels().filter((x) => x.id !== id)
  );
}

/** الكتالوج مع تعديلاتك المحلية (مقاسات معدّلة + موديلات أضفتها) */
export function mergeCatalog(base: Catalog): Catalog {
  const ov = getOverrides();
  const custom = getCustomModels();
  const models = base.models.map((m) => (ov[m.id] ? { ...m, template: ov[m.id] } : m));
  const brands = custom.length ? [...base.brands, CUSTOM_BRAND] : base.brands;
  return { brands, models: [...custom, ...models] };
}

export function getRecentIds(): string[] {
  return readJson<string[]>('cp.recent-models', []);
}

export function pushRecent(id: string) {
  const list = [id, ...getRecentIds().filter((x) => x !== id)].slice(0, 8);
  writeJson('cp.recent-models', list);
}

export function getPref<T>(key: string, fallback: T): T {
  return readJson<T>(`cp.pref.${key}`, fallback);
}

export function setPref(key: string, value: unknown) {
  writeJson(`cp.pref.${key}`, value);
}

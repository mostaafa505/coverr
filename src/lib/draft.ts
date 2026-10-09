import type { Design } from '@/types';

// حفظ تلقائي للتصميم في المتصفح (IndexedDB) عشان لو الصفحة اتقفلت بالغلط ما يضيعش الشغل

const DB = 'cover-print';
const STORE = 'draft';
const KEY = 'current';

export interface Draft {
  modelId: string;
  caseType: 'flat' | 'wrap3d';
  design: Design;
  /** عنصر الصورة → الملف الأصلي */
  blobs: Record<string, Blob>;
  savedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(d: Draft): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(d, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* الوضع الخاص أو التخزين مقفول */
  }
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const db = await open();
    const out = await new Promise<Draft | null>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Draft) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return out;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

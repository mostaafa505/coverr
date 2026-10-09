import fs from 'fs';
import path from 'path';
import { Brand, DeviceModel, Order } from '@/types';
import { INITIAL_BRANDS, INITIAL_MODELS } from './constants';

interface DatabaseSchema {
  brands: Brand[];
  models: DeviceModel[];
  orders: Order[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');

let memoryCache: DatabaseSchema | null = null;

function ensureDataFile(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initialData: DatabaseSchema = {
        brands: INITIAL_BRANDS,
        models: INITIAL_MODELS,
        orders: [],
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  } catch (err) {
    // Vercel serverless read-only filesystem
  }
}

function readData(): DatabaseSchema {
  if (memoryCache) return memoryCache;
  ensureDataFile();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryCache = JSON.parse(raw);
      return memoryCache!;
    }
  } catch (error) {
    console.error('Error reading database file:', error);
  }
  memoryCache = {
    brands: INITIAL_BRANDS,
    models: INITIAL_MODELS,
    orders: [],
  };
  return memoryCache;
}

function writeData(data: DatabaseSchema): void {
  memoryCache = data;
  try {
    ensureDataFile();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Filesystem read-only (e.g. Vercel Serverless), cached in memory.');
  }
}

export const db = {
  // BRANDS
  getBrands(): Brand[] {
    const data = readData();
    return data.brands;
  },

  getBrand(id: string): Brand | undefined {
    const data = readData();
    return data.brands.find((b) => b.id.toLowerCase() === id.toLowerCase());
  },

  saveBrand(brand: Brand): Brand {
    const data = readData();
    const index = data.brands.findIndex((b) => b.id === brand.id);
    if (index >= 0) {
      data.brands[index] = brand;
    } else {
      data.brands.push(brand);
    }
    writeData(data);
    return brand;
  },

  deleteBrand(id: string): boolean {
    const data = readData();
    const initialLen = data.brands.length;
    data.brands = data.brands.filter((b) => b.id !== id);
    if (data.brands.length !== initialLen) {
      writeData(data);
      return true;
    }
    return false;
  },

  // MODELS
  getModels(options?: {
    brandId?: string;
    search?: string;
    onlyActiveForPublic?: boolean;
    os?: 'android' | 'ios';
  }): DeviceModel[] {
    const data = readData();
    let result = [...data.models];

    if (options?.os) {
      const brandIdsInOs = data.brands
        .filter((b) => b.os === options.os)
        .map((b) => b.id);
      result = result.filter((m) => brandIdsInOs.includes(m.brandId));
    }

    if (options?.brandId) {
      result = result.filter((m) => m.brandId.toLowerCase() === options.brandId?.toLowerCase());
    }

    // STRICT USER RULE: If viewing publicly, ONLY show models that have active valid template!
    if (options?.onlyActiveForPublic) {
      result = result.filter(
        (m) =>
          m.status === 'active' &&
          m.template !== null &&
          m.template !== undefined &&
          m.template.widthMm > 0 &&
          m.template.heightMm > 0
      );
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      result = result.filter((m) => {
        const nameMatch = m.name.toLowerCase().includes(q);
        const aliasMatch = m.aliases?.some((a) => a.toLowerCase().includes(q));
        const notesMatch = m.notes?.toLowerCase().includes(q);
        return nameMatch || aliasMatch || notesMatch;
      });
    }

    return result;
  },

  getModel(id: string): DeviceModel | undefined {
    const data = readData();
    return data.models.find((m) => m.id.toLowerCase() === id.toLowerCase());
  },

  saveModel(model: DeviceModel): DeviceModel {
    const data = readData();
    const now = new Date().toISOString();
    const index = data.models.findIndex((m) => m.id === model.id);

    // Automatically ensure status reflects template availability if needed
    if (!model.template || model.template.widthMm <= 0 || model.template.heightMm <= 0) {
      model.status = 'needs_template';
    }

    if (index >= 0) {
      data.models[index] = {
        ...model,
        updatedAt: now,
      };
    } else {
      data.models.push({
        ...model,
        createdAt: now,
        updatedAt: now,
      });
    }

    writeData(data);
    return model;
  },

  deleteModel(id: string): boolean {
    const data = readData();
    const initialLen = data.models.length;
    data.models = data.models.filter((m) => m.id !== id);
    if (data.models.length !== initialLen) {
      writeData(data);
      return true;
    }
    return false;
  },

  bulkUpsertModels(models: DeviceModel[]): { count: number } {
    const data = readData();
    const now = new Date().toISOString();
    let count = 0;

    for (const model of models) {
      const index = data.models.findIndex(
        (m) => m.id === model.id || (m.name.toLowerCase() === model.name.toLowerCase() && m.brandId === model.brandId)
      );

      const toSave: DeviceModel = {
        ...model,
        updatedAt: now,
        createdAt: index >= 0 ? data.models[index].createdAt : now,
      };

      if (!toSave.template || toSave.template.widthMm <= 0 || toSave.template.heightMm <= 0) {
        toSave.status = 'needs_template';
      }

      if (index >= 0) {
        data.models[index] = toSave;
      } else {
        data.models.push(toSave);
      }
      count++;
    }

    writeData(data);
    return { count };
  },

  // ORDERS
  getOrders(): Order[] {
    const data = readData();
    return (data.orders || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getOrder(id: string): Order | undefined {
    const data = readData();
    return data.orders?.find((o) => o.id === id || o.orderNumber === id);
  },

  saveOrder(order: Order): Order {
    const data = readData();
    if (!data.orders) data.orders = [];

    const index = data.orders.findIndex((o) => o.id === order.id);
    if (index >= 0) {
      data.orders[index] = order;
    } else {
      data.orders.unshift(order);
    }
    writeData(data);
    return order;
  },

  deleteOrder(id: string): boolean {
    const data = readData();
    if (!data.orders) return false;
    const initialLen = data.orders.length;
    data.orders = data.orders.filter((o) => o.id !== id);
    if (data.orders.length !== initialLen) {
      writeData(data);
      return true;
    }
    return false;
  },
};

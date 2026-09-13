import { createSignal } from 'solid-js';
import { Category } from '../types';
import { db, DEFAULT_CATEGORIES } from '../services/db';

export interface ColorPreset {
  color: string;
  softColor: string;
  label: string;
}

export const PRESET_COLORS: ColorPreset[] = [
  { color: '#d48b6a', softColor: '#faeae1', label: 'Terracotta' },
  { color: '#7097c2', softColor: '#e8eff7', label: 'Biru Lembut' },
  { color: '#a688b8', softColor: '#f3edf7', label: 'Ungu Pastel' },
  { color: '#c47171', softColor: '#fae8e8', label: 'Merah Bata' },
  { color: '#c77d99', softColor: '#f7eaef', label: 'Rose' },
  { color: '#5a9e78', softColor: '#e6f3ec', label: 'Hijau Sage' },
  { color: '#d4a373', softColor: '#faedcd', label: 'Warm Sand' },
  { color: '#e07a5f', softColor: '#fbece8', label: 'Coral' },
  { color: '#3d5a80', softColor: '#e0fbfc', label: 'Deep Blue' },
  { color: '#8d877e', softColor: '#eeebe6', label: 'Warm Gray' },
];

export const PRESET_ICONS = [
  'Utensils',
  'Coffee',
  'Car',
  'ShoppingBag',
  'Receipt',
  'Film',
  'Heart',
  'Sparkles',
  'Home',
  'Book',
  'Gift',
  'Briefcase',
  'Smartphone',
  'Smile',
  'Music',
  'Plane',
  'MoreHorizontal',
] as const;

export type PresetIconName = typeof PRESET_ICONS[number];

const [categories, setCategories] = createSignal<Category[]>(DEFAULT_CATEGORIES);
const [isLoadingCategories, setIsLoadingCategories] = createSignal<boolean>(false);

export { categories, isLoadingCategories };

export async function loadCategories(): Promise<void> {
  setIsLoadingCategories(true);
  try {
    const list = await db.getAllCategories();
    setCategories(list);
  } catch (err) {
    console.error('Gagal memuat kategori:', err);
  } finally {
    setIsLoadingCategories(false);
  }
}

export function getCategoryConfig(categoryName: string): {
  label: string;
  color: string;
  softColor: string;
  icon: string;
} {
  const found = categories().find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (found) {
    return {
      label: found.name,
      color: found.color,
      softColor: found.softColor,
      icon: found.icon,
    };
  }

  const fallback = categories().find((c) => c.name === 'Lainnya') || DEFAULT_CATEGORIES[5];
  return {
    label: categoryName,
    color: fallback.color,
    softColor: fallback.softColor,
    icon: fallback.icon,
  };
}

export async function addCategory(input: {
  name: string;
  color: string;
  softColor: string;
  icon: string;
}): Promise<Category> {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error('Nama kategori tidak boleh kosong');
  }

  const existing = categories().find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existing) {
    throw new Error(`Kategori "${trimmedName}" sudah ada`);
  }

  const newCat: Category = {
    id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    name: trimmedName,
    color: input.color,
    softColor: input.softColor,
    icon: input.icon,
    isDefault: false,
    order: categories().length + 1,
  };

  await db.saveCategory(newCat);
  setCategories([...categories(), newCat]);
  return newCat;
}

export async function removeCategory(id: string): Promise<void> {
  const target = categories().find((c) => c.id === id);
  if (!target) return;
  if (target.isDefault) {
    throw new Error('Kategori default tidak dapat dihapus');
  }

  await db.deleteCategory(id);
  setCategories(categories().filter((c) => c.id !== id));
}

// Inisialisasi otomatis
loadCategories();

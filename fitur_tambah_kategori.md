# Fitur Tambah Kategori (Custom Expense Categories) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memungkinkan pengguna menambahkan kategori pengeluaran kustom (nama, icon Lucide, warna) yang tersimpan di IndexedDB (Dexie) dan kompatibel dengan sync Google Sheet, serta menambahkan tampilan Splash / Loading Screen pembuka aplikasi yang unyu dan bersih saat aplikasi pertama kali dibuka atau sedang memuat data.

**Architecture:** Memperluas skema IndexedDB Dexie dengan tabel `categories` (pre-seeded kategori bawaan). Membuat store reactive Solid.js `categoryStore.ts` untuk mengelola state kategori, pemetaan konfigurasi dinamis (`color`, `softColor`, `icon`), dan komponen `CategoryIcon` serbaguna. Menyediakan modal `AddCategoryModal` yang dapat diakses langsung dari chip bar `ExpenseForm` dan menu pengaturan `SettingsView`. Menambahkan state `isAppLoading` di `App.tsx` dengan tampilan splash screen pembuka aplikasi (logo besar, H1, dan tagline H3).

**Tech Stack:** Solid.js, TypeScript, Dexie.js (IndexedDB), Tailwind CSS, Lucide Solid, Vitest (unit testing).

**Spec:** `/Users/yoga/Developer/Personal/cupu-finance/fitur_tambah_kategori.md`

## Global Constraints

- Semua warna kategori baru harus harmonis dengan tema warm-neutral Cupu Finance (`#edede9`, `#f5ebe0`, `#2d2825`).
- Kategori default (Makanan, Transport, Belanja, Tagihan, Hiburan, Lainnya) tidak boleh dihapus agar data bawaan tetap konsisten.
- Tipe data `Expense.category` tetap kompatibel dengan Google Sheets (string teks bebas) tanpa merusak format sheet yang ada.
- Tidak ada dependensi eksternal baru selain `vitest` + `fake-indexeddb` untuk pengetesan unit test.

---

### Task 1: Setup Testing Environment (Vitest & Fake IndexedDB)

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts` (update with test config)
- Create: `tests/setup.ts`

**Interfaces:**
- Consumes: Dexie, Solid.js
- Produces: `pnpm test` executable runner

- [ ] **Step 1: Install dev dependencies untuk testing**

Run: `pnpm add -D vitest fake-indexeddb`

- [ ] **Step 2: Update `vite.config.ts` untuk konfigurasi Vitest**

```typescript
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 3: Buat file setup test `tests/setup.ts`**

```typescript
import 'fake-indexeddb/auto';
```

- [ ] **Step 4: Tambahkan script `test` di `package.json` dan verifikasi**

Tambahkan `"test": "vitest run"` di `package.json`.
Run: `pnpm test`
Expected: Output 0 tests or test runner exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts tests/setup.ts
git commit -m "chore: setup vitest and fake-indexeddb for unit tests"
```

---

### Task 2: Update Types & Dexie Schema Version 2

**Files:**
- Modify: `src/types/index.ts:1-18`
- Modify: `src/services/db.ts:1-40`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: Dexie schema
- Produces: `Category` interface, `CupuDatabase.categories` Table, Dexie migration v2

- [ ] **Step 1: Tulis unit test yang memverifikasi skema Dexie v2 dan seeding kategori**

Buat file `tests/db.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CupuDatabase } from '../src/services/db';

describe('CupuDatabase v2 Categories', () => {
  let db: CupuDatabase;

  beforeEach(() => {
    db = new CupuDatabase();
  });

  it('harus menginisialisasi 6 kategori default jika database baru', async () => {
    const cats = await db.getAllCategories();
    expect(cats.length).toBe(6);
    expect(cats.map(c => c.name)).toContain('Makanan');
    expect(cats.map(c => c.name)).toContain('Lainnya');
  });

  it('bisa menambah dan menghapus kategori kustom', async () => {
    await db.saveCategory({
      id: 'cat_kopi',
      name: 'Kopi',
      color: '#b08968',
      softColor: '#ede0d4',
      icon: 'Coffee',
      isDefault: false,
      order: 7,
    });

    let cats = await db.getAllCategories();
    expect(cats.some(c => c.name === 'Kopi')).toBe(true);

    await db.deleteCategory('cat_kopi');
    cats = await db.getAllCategories();
    expect(cats.some(c => c.name === 'Kopi')).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal (fail)**

Run: `pnpm test tests/db.test.ts`
Expected: FAIL (`getAllCategories is not a function` atau sejenisnya)

- [ ] **Step 3: Update `src/types/index.ts`**

Ubah definisi kategori di `src/types/index.ts`:
```typescript
export interface Category {
  id: string;
  name: string;
  color: string;
  softColor: string;
  icon: string;
  isDefault?: boolean;
  order?: number;
}

export type ExpenseCategory = string;
```

- [ ] **Step 4: Update `src/services/db.ts` dengan schema version 2 dan seeding**

Di `src/services/db.ts`:
```typescript
import Dexie, { Table } from 'dexie';
import { Expense, Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_makanan', name: 'Makanan', color: '#d48b6a', softColor: '#faeae1', icon: 'Utensils', isDefault: true, order: 1 },
  { id: 'cat_transport', name: 'Transport', color: '#7097c2', softColor: '#e8eff7', icon: 'Car', isDefault: true, order: 2 },
  { id: 'cat_belanja', name: 'Belanja', color: '#a688b8', softColor: '#f3edf7', icon: 'ShoppingBag', isDefault: true, order: 3 },
  { id: 'cat_tagihan', name: 'Tagihan', color: '#c47171', softColor: '#fae8e8', icon: 'Receipt', isDefault: true, order: 4 },
  { id: 'cat_hiburan', name: 'Hiburan', color: '#c77d99', softColor: '#f7eaef', icon: 'Film', isDefault: true, order: 5 },
  { id: 'cat_lainnya', name: 'Lainnya', color: '#8d877e', softColor: '#eeebe6', icon: 'MoreHorizontal', isDefault: true, order: 6 },
];

export class CupuDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('CupuFinanceDB');

    this.version(1).stores({
      expenses: 'id, date, category, updated_at, is_deleted, sync_status, [date+is_deleted]'
    });

    this.version(2).stores({
      expenses: 'id, date, category, updated_at, is_deleted, sync_status, [date+is_deleted]',
      categories: 'id, name, order, isDefault'
    }).upgrade(async (tx) => {
      const catTable = tx.table<Category, string>('categories');
      await catTable.bulkPut(DEFAULT_CATEGORIES);
    });

    this.on('ready', async () => {
      const count = await this.categories.count();
      if (count === 0) {
        await this.categories.bulkPut(DEFAULT_CATEGORIES);
      }
    });
  }

  async getAllCategories(): Promise<Category[]> {
    const cats = await this.categories.toArray();
    if (cats.length === 0) {
      await this.categories.bulkPut(DEFAULT_CATEGORIES);
      return [...DEFAULT_CATEGORIES];
    }
    return cats.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  async saveCategory(category: Category): Promise<void> {
    await this.categories.put(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const cat = await this.categories.get(id);
    if (cat?.isDefault) {
      throw new Error('Kategori bawaan tidak boleh dihapus');
    }
    await this.categories.delete(id);
  }
  // ... sisa method getExpensesForMonth dll tetap sama
```

- [ ] **Step 5: Jalankan test kembali untuk memverifikasi pass**

Run: `pnpm test tests/db.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/services/db.ts tests/db.test.ts
git commit -m "feat(db): add categories table with migration and default seeding"
```

---

### Task 3: Buat Reactive Category Store (`categoryStore.ts`)

**Files:**
- Create: `src/stores/categoryStore.ts`
- Test: `tests/categoryStore.test.ts`

**Interfaces:**
- Consumes: `CupuDatabase` (`db.getAllCategories`, `db.saveCategory`, `db.deleteCategory`)
- Produces:
  - `categories`: `Accessor<Category[]>`
  - `loadCategories(): Promise<void>`
  - `addCategory(input: { name: string; color: string; softColor: string; icon: string }): Promise<Category>`
  - `removeCategory(id: string): Promise<void>`
  - `getCategoryConfig(name: string): { label: string; color: string; softColor: string; icon: string }`
  - `PRESET_COLORS`: array warna harmonis
  - `PRESET_ICONS`: array pilihan nama icon Lucide

- [ ] **Step 1: Tulis unit test untuk `categoryStore`**

Buat file `tests/categoryStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  categories,
  loadCategories,
  addCategory,
  removeCategory,
  getCategoryConfig
} from '../src/stores/categoryStore';

describe('categoryStore', () => {
  beforeEach(async () => {
    await loadCategories();
  });

  it('memuat kategori default', () => {
    expect(categories().length).toBeGreaterThanOrEqual(6);
    const config = getCategoryConfig('Makanan');
    expect(config.color).toBe('#d48b6a');
  });

  it('fallback ke Lainnya untuk kategori tidak dikenal', () => {
    const config = getCategoryConfig('KategoriAcakUnknown');
    expect(config.label).toBe('KategoriAcakUnknown');
    expect(config.color).toBe('#8d877e');
  });

  it('bisa menambah kategori kustom baru dan merefleksikannya di config', async () => {
    const baru = await addCategory({
      name: 'Kesehatan',
      color: '#457b9d',
      softColor: '#e1ecf4',
      icon: 'Heart',
    });

    expect(categories().some(c => c.name === 'Kesehatan')).toBe(true);
    const config = getCategoryConfig('Kesehatan');
    expect(config.color).toBe('#457b9d');
    expect(config.icon).toBe('Heart');

    await removeCategory(baru.id);
    expect(categories().some(c => c.name === 'Kesehatan')).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal (fail)**

Run: `pnpm test tests/categoryStore.test.ts`
Expected: FAIL (`Cannot find module '../src/stores/categoryStore'`)

- [ ] **Step 3: Implementasi `src/stores/categoryStore.ts`**

```typescript
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
```

- [ ] **Step 4: Jalankan test untuk memverifikasi pass**

Run: `pnpm test tests/categoryStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/categoryStore.ts tests/categoryStore.test.ts
git commit -m "feat: add reactive categoryStore with preset icons and colors"
```

---

### Task 4: Buat Komponen Dinamis `CategoryIcon.tsx`

**Files:**
- Create: `src/components/CategoryIcon.tsx`
- Test: Verifikasi via Vite typecheck & compile

**Interfaces:**
- Consumes: Lucide icons (`Utensils`, `Coffee`, `Car`, `ShoppingBag`, `Receipt`, `Film`, `Heart`, `Sparkles`, `Home`, `Book`, `Gift`, `Briefcase`, `Smartphone`, `Smile`, `Music`, `Plane`, `MoreHorizontal`)
- Produces: `<CategoryIcon name={iconName} class="w-4 h-4" style={{ color }} />`

- [ ] **Step 1: Implementasi `src/components/CategoryIcon.tsx`**

```tsx
import { Component } from 'solid-js';
import {
  Utensils,
  Coffee,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  Heart,
  Sparkles,
  Home,
  Book,
  Gift,
  Briefcase,
  Smartphone,
  Smile,
  Music,
  Plane,
  MoreHorizontal,
} from 'lucide-solid';

interface CategoryIconProps {
  name: string;
  class?: string;
  style?: Record<string, string | undefined>;
}

export const CategoryIcon: Component<CategoryIconProps> = (props) => {
  const iconClass = () => props.class || 'w-4 h-4';

  switch (props.name) {
    case 'Utensils':
      return <Utensils class={iconClass()} style={props.style} />;
    case 'Coffee':
      return <Coffee class={iconClass()} style={props.style} />;
    case 'Car':
      return <Car class={iconClass()} style={props.style} />;
    case 'ShoppingBag':
      return <ShoppingBag class={iconClass()} style={props.style} />;
    case 'Receipt':
      return <Receipt class={iconClass()} style={props.style} />;
    case 'Film':
      return <Film class={iconClass()} style={props.style} />;
    case 'Heart':
      return <Heart class={iconClass()} style={props.style} />;
    case 'Sparkles':
      return <Sparkles class={iconClass()} style={props.style} />;
    case 'Home':
      return <Home class={iconClass()} style={props.style} />;
    case 'Book':
      return <Book class={iconClass()} style={props.style} />;
    case 'Gift':
      return <Gift class={iconClass()} style={props.style} />;
    case 'Briefcase':
      return <Briefcase class={iconClass()} style={props.style} />;
    case 'Smartphone':
      return <Smartphone class={iconClass()} style={props.style} />;
    case 'Smile':
      return <Smile class={iconClass()} style={props.style} />;
    case 'Music':
      return <Music class={iconClass()} style={props.style} />;
    case 'Plane':
      return <Plane class={iconClass()} style={props.style} />;
    default:
      return <MoreHorizontal class={iconClass()} style={props.style} />;
  }
};
```

- [ ] **Step 2: Jalankan `pnpm build` untuk verifikasi kompabilitas tipe Solid**

Run: `pnpm run build`
Expected: Build sukses tanpa error TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryIcon.tsx
git commit -m "feat(ui): add universal CategoryIcon component"
```

---

### Task 5: Buat Modal Tambah Kategori (`AddCategoryModal.tsx`)

**Files:**
- Create: `src/components/AddCategoryModal.tsx`

**Interfaces:**
- Consumes: `categoryStore` (`addCategory`, `PRESET_COLORS`, `PRESET_ICONS`), `CategoryIcon`
- Produces: `<AddCategoryModal isOpen={...} onClose={...} onCreated={(newCat) => ...} />`

- [ ] **Step 1: Buat komponen `src/components/AddCategoryModal.tsx`**

Komponen modal menyediakan:
1. Input nama kategori teks.
2. Grid pemilihan icon dari `PRESET_ICONS`.
3. Grid pemilihan warna dari `PRESET_COLORS`.
4. Live preview chip kategori sebelum disimpan.
5. Tombol Simpan & Batal dengan validasi error.

```tsx
import { Component, createSignal, For, Show } from 'solid-js';
import {
  PRESET_COLORS,
  PRESET_ICONS,
  addCategory,
  ColorPreset,
} from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import { Category } from '../types';
import { X, Check } from 'lucide-solid';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (category: Category) => void;
}

export const AddCategoryModal: Component<AddCategoryModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [selectedColor, setSelectedColor] = createSignal<ColorPreset>(PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = createSignal<string>(PRESET_ICONS[0]);
  const [errorMessage, setErrorMessage] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const resetForm = () => {
    setName('');
    setSelectedColor(PRESET_COLORS[0]);
    setSelectedIcon(PRESET_ICONS[0]);
    setErrorMessage('');
  };

  const handleClose = () => {
    resetForm();
    props.onClose();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) {
      setErrorMessage('Nama kategori wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const created = await addCategory({
        name: name().trim(),
        color: selectedColor().color,
        softColor: selectedColor().softColor,
        icon: selectedIcon(),
      });
      props.onCreated?.(created);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div class="w-full max-w-sm bg-warm-card border border-warm-border rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="flex items-center justify-between pb-3 border-b border-warm-border/60">
            <h3 class="text-base font-bold text-warm-ink">Tambah Kategori Baru</h3>
            <button
              type="button"
              onClick={handleClose}
              class="p-1 rounded-full text-warm-mute hover:text-warm-ink hover:bg-warm-subtle transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} class="mt-4 space-y-4">
            {/* Live Preview */}
            <div class="flex flex-col items-center justify-center py-2 bg-warm-canvas/60 rounded-xl border border-warm-border/60">
              <span class="text-[11px] font-semibold text-warm-mute mb-2">Preview Tampilan</span>
              <div
                class="flex items-center gap-2 px-4 py-2 rounded-full border shadow-xs"
                style={{
                  'background-color': selectedColor().softColor,
                  'border-color': selectedColor().color + '40',
                }}
              >
                <CategoryIcon
                  name={selectedIcon()}
                  class="w-4 h-4"
                  style={{ color: selectedColor().color }}
                />
                <span class="text-xs font-bold text-warm-ink">
                  {name().trim() || 'Nama Kategori'}
                </span>
              </div>
            </div>

            {/* Input Nama */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1">
                Nama Kategori
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Contoh: Kopi, Skincare, Sedekah"
                maxlength={24}
                class="w-full px-3 py-2 text-sm bg-warm-canvas border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary font-medium"
                autofocus
              />
            </div>

            {/* Pilih Ikon */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1.5">
                Pilih Ikon
              </label>
              <div class="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-warm-canvas/50 rounded-xl border border-warm-border/50">
                <For each={PRESET_ICONS}>
                  {(icon) => {
                    const isSelected = () => selectedIcon() === icon;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        class={`p-2 rounded-xl flex items-center justify-center transition-all ${
                          isSelected()
                            ? 'bg-warm-primary text-white shadow-xs scale-105'
                            : 'text-warm-mute hover:text-warm-ink hover:bg-warm-subtle'
                        }`}
                      >
                        <CategoryIcon name={icon} class="w-4 h-4" />
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Pilih Warna */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1.5">
                Pilih Warna Tema
              </label>
              <div class="grid grid-cols-5 gap-2 p-1 bg-warm-canvas/50 rounded-xl border border-warm-border/50">
                <For each={PRESET_COLORS}>
                  {(cp) => {
                    const isSelected = () => selectedColor().color === cp.color;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedColor(cp)}
                        class="h-8 rounded-lg flex items-center justify-center transition-transform relative"
                        style={{ 'background-color': cp.color }}
                        title={cp.label}
                      >
                        <Show when={isSelected()}>
                          <Check class="w-4 h-4 text-white" />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Error Message */}
            <Show when={errorMessage()}>
              <p class="text-xs text-cat-bills font-medium">{errorMessage()}</p>
            </Show>

            {/* Action Buttons */}
            <div class="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                class="flex-1 py-2 text-xs font-semibold text-warm-mute bg-warm-subtle rounded-xl hover:text-warm-ink transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting()}
                class="flex-1 py-2 text-xs font-semibold text-white bg-warm-primary hover:bg-warm-primary-dark rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting() ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};
```

- [ ] **Step 2: Jalankan `pnpm run build` untuk memverifikasi sintaks dan compile**

Run: `pnpm run build`
Expected: Build berhasil tanpa error.

- [ ] **Step 3: Commit**

```bash
git add src/components/AddCategoryModal.tsx
git commit -m "feat(ui): add AddCategoryModal with live preview, icons, and color presets"
```

---

### Task 6: Integrasi Kategori Dinamis di `expenseStore.ts` & `ExpenseForm.tsx`

**Files:**
- Modify: `src/stores/expenseStore.ts`
- Modify: `src/components/ExpenseForm.tsx`

**Interfaces:**
- Consumes: `categories()`, `getCategoryConfig()`, `CategoryIcon`, `AddCategoryModal`
- Produces: Dynamic category selection chip list with `+ Tambah` button

- [ ] **Step 1: Update `categoryBreakdown` di `src/stores/expenseStore.ts`**

Import `categories` dan `getCategoryConfig` dari `./categoryStore`.
Ubah kalkulasi `categoryBreakdown`:
```typescript
import { categories, getCategoryConfig } from './categoryStore';

export const categoryBreakdown = createMemo<CategorySummary[]>(() => {
  const items = expenses();
  const total = totalMonthlyExpense();
  const categoryMap: Record<string, number> = {};

  items.forEach((item) => {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
  });

  const allCats = categories();
  const list: CategorySummary[] = allCats.map((cat) => {
    const catTotal = categoryMap[cat.name] || 0;
    const pct = total > 0 ? Math.round((catTotal / total) * 100) : 0;
    return {
      category: cat.name,
      total: catTotal,
      percentage: pct,
      color: cat.color,
      softColor: cat.softColor,
    };
  });

  return list.sort((a, b) => b.total - a.total);
});
```

- [ ] **Step 2: Update `src/components/ExpenseForm.tsx`**

1. Import `categories`, `getCategoryConfig`, `CategoryIcon`, dan `AddCategoryModal`.
2. Ganti list chip statis dengan iterasi `categories()`.
3. Tambahkan chip tombol `+ Tambah` di samping list kategori.
4. Ketika kategori baru dibuat via modal, otomatis pilih kategori tersebut (`setSelectedCategory(newCat.name)`).
5. Ganti `renderCategoryIcon` dengan `<CategoryIcon name={getCategoryConfig(cat).icon} />`.

- [ ] **Step 3: Jalankan verifikasi build**

Run: `pnpm run build`
Expected: Build PASS

- [ ] **Step 4: Commit**

```bash
git add src/stores/expenseStore.ts src/components/ExpenseForm.tsx
git commit -m "feat(ui): integrate dynamic categories and quick-add modal in ExpenseForm"
```

---

### Task 7: Update `ExpenseItem.tsx`, `MonthlyRecap.tsx`, dan `DeleteConfirmModal.tsx`

**Files:**
- Modify: `src/components/ExpenseItem.tsx`
- Modify: `src/components/DeleteConfirmModal.tsx`
- Modify: `src/components/MonthlyRecap.tsx`

**Interfaces:**
- Consumes: `getCategoryConfig`, `CategoryIcon`
- Produces: Komponen list, modal delete, dan rekap bulanan menampilkan nama, warna, dan icon yang sesuai untuk kategori kustom

- [ ] **Step 1: Refactor `src/components/ExpenseItem.tsx`**

Ganti hardcoded switch icon dengan:
```tsx
import { getCategoryConfig } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';

// ...
const config = () => getCategoryConfig(props.expense.category);

// Pada render icon:
<div
  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
  style={{ 'background-color': config().softColor }}
>
  <CategoryIcon name={config().icon} class="w-4 h-4" style={{ color: config().color }} />
</div>
```

- [ ] **Step 2: Refactor `src/components/DeleteConfirmModal.tsx`**

Gunakan `getCategoryConfig` dan `CategoryIcon` untuk menampilkan detail transaksi yang akan dihapus.

- [ ] **Step 3: Refactor `src/components/MonthlyRecap.tsx`**

Gunakan `CategoryIcon` dan konfigurasi warna dinamis untuk setiap baris kategori di breakdown bulanan.

- [ ] **Step 4: Jalankan test dan build**

Run: `pnpm test && pnpm run build`
Expected: Semua test lolos dan build sukses.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseItem.tsx src/components/DeleteConfirmModal.tsx src/components/MonthlyRecap.tsx
git commit -m "refactor(ui): use dynamic CategoryIcon in ExpenseItem, DeleteConfirmModal, and MonthlyRecap"
```

---

### Task 8: Tambahkan Manajemen Kategori di `SettingsView.tsx`

**Files:**
- Modify: `src/components/SettingsView.tsx`

**Interfaces:**
- Consumes: `categories()`, `removeCategory()`, `AddCategoryModal`, `CategoryIcon`
- Produces: Bagian "Kelola Kategori" di Pengaturan dengan daftar kategori, label badge default/kustom, tombol hapus untuk kustom, dan tombol tambah kategori baru

- [ ] **Step 1: Tambahkan Section "Kelola Kategori" di `SettingsView.tsx`**

1. Tampilkan collapsible atau card "Kelola Kategori" dengan ikon `Tag` / `Layers`.
2. Render daftar kategori saat ini dalam bentuk list ringkas:
   - Icon & warna kategori.
   - Nama kategori.
   - Badge "Bawaan" (untuk kategori default).
   - Tombol icon `Trash2` (untuk kategori kustom, dengan konfirmasi sebelum hapus).
3. Tombol "+ Tambah Kategori" yang memicu pembukaan `AddCategoryModal`.

- [ ] **Step 2: Jalankan full test suite dan build**

Run: `pnpm test && pnpm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsView.tsx
git commit -m "feat(settings): add category management section in SettingsView"
```

---

### Task 9: Branded Splash & App Loading Screen

**Files:**
- Modify: `src/App.tsx`
- Test: Verifikasi browser / build test

**Interfaces:**
- Consumes: `logoImg`, `initSettings`, `loadExpensesForSelectedMonth`, `loadCategories`, `initNetworkListener`
- Produces: Smooth branded loading/splash screen saat aplikasi pertama kali dibuka atau sedang memuat data awal

- [ ] **Step 1: Implementasi Splash / Loading Screen di `src/App.tsx`**

Tambahkan state `isAppLoading` dan render screen splash branding yang diminta:
```tsx
import { Component, createSignal, onMount, Switch, Match, Show } from 'solid-js';
import { initSettings, settings, isLoadingSettings } from './stores/settingsStore';
import { initNetworkListener } from './services/network';
import { initSyncManager } from './services/sync/syncManager';
import { loadExpensesForSelectedMonth } from './stores/expenseStore';
import { loadCategories } from './stores/categoryStore';
// ... import komponen lainnya ...
import logoImg from './assets/logo.png';

export const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<ActiveTab>('catat');
  const [isAppLoading, setIsAppLoading] = createSignal<boolean>(true);

  onMount(async () => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([
        initSettings(),
        initNetworkListener(),
        loadExpensesForSelectedMonth(),
        loadCategories(),
        minDelay,
      ]);
      initSyncManager();
    } catch (err) {
      console.error('Error saat inisialisasi aplikasi:', err);
    } finally {
      setIsAppLoading(false);
    }
  });

  return (
    <div class="min-h-screen bg-warm-canvas text-warm-ink flex flex-col items-center">
      {/* 1. BRANDED SPLASH / INITIAL LOADING SCREEN */}
      <Show when={isAppLoading()}>
        <div class="fixed inset-0 z-50 bg-warm-canvas flex flex-col items-center justify-between px-4 py-4 min-h-screen">
          <div class="w-full flex-1 flex flex-col items-center justify-between animate-fadeIn py-4">
            {/* TENGAH: LOGO, H1 & H3 */}
            <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
              <img
                src={logoImg}
                alt="Cupu Finance Logo"
                class="w-44 h-44 object-contain drop-shadow-md mb-6"
              />
              <h1 class="text-3xl font-extrabold text-warm-ink tracking-tight mb-2">
                Cupu Finance
              </h1>
              <h3 class="text-sm font-semibold text-warm-primary tracking-wide">
                Catat Uang Paling Unyu
              </h3>
            </div>
          </div>
        </div>
      </Show>

      {/* 2. ONBOARDING SCREEN (SETELAH SPLASH, JIKA BELUM PERNAH ONBOARDING) */}
      <Show when={!isAppLoading() && !settings().hasSeenOnboarding}>
        <OnboardingView />
      </Show>

      {/* 3. KONTEN UTAMA APLIKASI */}
      <div class="w-full max-w-md min-h-screen flex flex-col bg-warm-canvas px-4 pt-3 pb-24 relative">
        {/* ... sisa struktur header & main ... */}
```

- [ ] **Step 2: Jalankan build untuk verifikasi**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): add branded splash and initial loading screen with logo and tagline"
```

---

### Task 10: Verifikasi Akhir dan Android Sync

**Files:**
- Sync ke Android: `android/app/src/main/assets/public`

- [ ] **Step 1: Jalankan seluruh test unit**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 2: Jalankan build web & sync Capacitor**

Run: `pnpm run build && npx cap sync android`
Expected: Build & sync berhasil.

- [ ] **Step 3: Verifikasi build Android APK**

Run: `cd android && ./gradlew assembleDebug && cd ..`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit dan selesaikan**

```bash
git add -A
git commit -m "feat: complete custom category management feature and branded splash screen across web and android"
```

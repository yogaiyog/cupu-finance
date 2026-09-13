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

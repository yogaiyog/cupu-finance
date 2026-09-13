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
    expect(categories().length).toBeGreaterThanOrEqual(5);
    const config = getCategoryConfig('Makanan');
    expect(config.color).toBe('#6b635b');
  });

  it('fallback untuk kategori tidak dikenal', () => {
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

import Dexie, { Table } from 'dexie';
import { Expense, Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_makanan', name: 'Makanan', color: '#6b635b', softColor: '#e8e4df', icon: 'Utensils', isDefault: true, order: 1 },
  { id: 'cat_transport', name: 'Transportasi', color: '#6b635b', softColor: '#e8e4df', icon: 'Car', isDefault: true, order: 2 },
  { id: 'cat_belanja', name: 'Belanja', color: '#6b635b', softColor: '#e8e4df', icon: 'ShoppingBag', isDefault: true, order: 3 },
  { id: 'cat_tagihan', name: 'Tagihan', color: '#6b635b', softColor: '#e8e4df', icon: 'Receipt', isDefault: true, order: 4 },
  { id: 'cat_hiburan', name: 'Hiburan', color: '#6b635b', softColor: '#e8e4df', icon: 'Film', isDefault: true, order: 5 },
];

export class CupuDatabase extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;

  constructor() {
    super('CupuFinanceDB');

    // Schema definition for IndexedDB
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
      // Hapus kategori 'Lainnya' jika ada
      try {
        await this.categories.delete('cat_lainnya');
      } catch {}
      const count = await this.categories.count();
      if (count === 0) {
        await this.categories.bulkPut(DEFAULT_CATEGORIES);
      }
    });
  }

  /**
   * Mengambil seluruh daftar kategori (diurutkan berdasarkan order)
   */
  async getAllCategories(): Promise<Category[]> {
    try {
      await this.categories.delete('cat_lainnya');
    } catch {}

    // Update kategori default ke warmgrey jika masih menggunakan warna lama
    for (const def of DEFAULT_CATEGORIES) {
      try {
        const existing = await this.categories.get(def.id);
        if (existing && (existing.color !== def.color || existing.softColor !== def.softColor)) {
          await this.categories.update(def.id, { color: def.color, softColor: def.softColor });
        }
      } catch {}
    }

    const cats = await this.categories.toArray();
    if (cats.length === 0) {
      await this.categories.bulkPut(DEFAULT_CATEGORIES);
      return [...DEFAULT_CATEGORIES];
    }
    return cats
      .filter((c) => c.name !== 'Lainnya' && c.id !== 'cat_lainnya')
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  /**
   * Menyimpan atau memperbarui satu kategori
   */
  async saveCategory(category: Category): Promise<void> {
    await this.categories.put(category);
  }

  /**
   * Menghapus kategori kustom berdasarkan ID (kategori default tidak boleh dihapus)
   */
  async deleteCategory(id: string): Promise<void> {
    const cat = await this.categories.get(id);
    if (cat?.isDefault) {
      throw new Error('Kategori bawaan tidak boleh dihapus');
    }
    await this.categories.delete(id);
  }

  /**
   * Mengambil semua transaksi aktif (tidak soft-deleted) untuk bulan tertentu (format YYYY-MM)
   */
  async getExpensesForMonth(yearMonth: string): Promise<Expense[]> {
    const allInMonth = await this.expenses
      .where('date')
      .startsWith(yearMonth)
      .toArray();

    return allInMonth
      .filter((item) => !item.is_deleted)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updated_at - a.updated_at);
  }

  /**
   * Menyimpan atau memperbarui satu transaksi pengeluaran
   */
  async saveExpense(expense: Expense): Promise<void> {
    await this.expenses.put(expense);
  }

  /**
   * Melakukan soft delete transaksi agar status penghapusan bisa disinkronkan ke cloud
   */
  async softDeleteExpense(id: string): Promise<void> {
    const existing = await this.expenses.get(id);
    if (existing) {
      existing.is_deleted = true;
      existing.updated_at = Date.now();
      existing.sync_status = 'pending';
      await this.expenses.put(existing);
    }
  }

  /**
   * Mengambil semua data yang memiliki perubahan tertunda (sync_status = 'pending')
   */
  async getPendingExpenses(): Promise<Expense[]> {
    return await this.expenses
      .where('sync_status')
      .equals('pending')
      .toArray();
  }

  /**
   * Menandai daftar ID transaksi sebagai telah tersinkron
   */
  async markAsSynced(ids: string[]): Promise<void> {
    await this.transaction('rw', this.expenses, async () => {
      for (const id of ids) {
        const item = await this.expenses.get(id);
        if (item && item.sync_status === 'pending') {
          item.sync_status = 'synced';
          await this.expenses.put(item);
        }
      }
    });
  }

  /**
   * Menggabungkan data batch dari Google Sheets / Server dengan strategi Last-Write-Wins
   */
  async mergeServerChanges(serverItems: Expense[]): Promise<void> {
    await this.transaction('rw', this.expenses, async () => {
      for (const serverItem of serverItems) {
        const local = await this.expenses.get(serverItem.id);
        if (!local) {
          // Data baru dari server
          await this.expenses.put({
            ...serverItem,
            sync_status: 'synced',
          });
        } else {
          // Resolusi konflik: data dengan updated_at lebih baru menang
          if (serverItem.updated_at >= local.updated_at) {
            await this.expenses.put({
              ...serverItem,
              sync_status: 'synced',
            });
          }
        }
      }
    });
  }

  /**
   * Mengambil semua transaksi aktif (tidak dihapus)
   */
  async getAllActiveExpenses(): Promise<Expense[]> {
    return await this.expenses
      .filter((item) => !item.is_deleted)
      .reverse()
      .sortBy('date');
  }

  /**
   * Export data transaksi ke format CSV murni tanpa library pihak ketiga
   */
  async exportToCsv(): Promise<string> {
    const items = await this.getAllActiveExpenses();

    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['ID', 'Tanggal', 'Kategori', 'Nominal', 'Catatan', 'Status Sinkronisasi'];
    const rows = items.map((item) => [
      escapeCell(item.id),
      escapeCell(item.date),
      escapeCell(item.category),
      escapeCell(item.amount),
      escapeCell(item.note || ''),
      escapeCell(item.sync_status === 'synced' ? 'Tersinkron' : 'Tertunda'),
    ]);

    const csvLines = [headers.join(','), ...rows.map((r) => r.join(','))];
    return csvLines.join('\r\n');
  }

  /**
   * Menghapus seluruh data lokal
   */
  async clearAll(): Promise<void> {
    await this.expenses.clear();
  }
}

export const db = new CupuDatabase();

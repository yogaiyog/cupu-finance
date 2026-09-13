import Dexie, { Table } from 'dexie';
import { Expense } from '../types';

export class CupuDatabase extends Dexie {
  expenses!: Table<Expense, string>;

  constructor() {
    super('CupuFinanceDB');

    // Schema definition for IndexedDB
    this.version(1).stores({
      expenses: 'id, date, category, updated_at, is_deleted, sync_status, [date+is_deleted]'
    });
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

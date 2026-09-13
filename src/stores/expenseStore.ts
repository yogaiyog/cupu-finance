import { createSignal, createMemo } from 'solid-js';
import { db } from '../services/db';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { triggerSync, refreshPendingCount } from '../services/sync/syncManager';

// Default bulan saat ini: YYYY-MM
const getCurrentYearMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// State Signals
const [selectedMonth, setSelectedMonth] = createSignal<string>(getCurrentYearMonth());
const [expenses, setExpenses] = createSignal<Expense[]>([]);
const [isLoadingExpenses, setIsLoadingExpenses] = createSignal<boolean>(false);

// Konfigurasi Kategori & Warna Soft
export const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; color: string; softColor: string; icon: string }
> = {
  Makanan: {
    label: 'Makanan',
    color: '#d48b6a',
    softColor: '#faeae1',
    icon: 'Utensils',
  },
  Transport: {
    label: 'Transport',
    color: '#7097c2',
    softColor: '#e8eff7',
    icon: 'Car',
  },
  Belanja: {
    label: 'Belanja',
    color: '#a688b8',
    softColor: '#f3edf7',
    icon: 'ShoppingBag',
  },
  Tagihan: {
    label: 'Tagihan',
    color: '#c47171',
    softColor: '#fae8e8',
    icon: 'Receipt',
  },
  Hiburan: {
    label: 'Hiburan',
    color: '#c77d99',
    softColor: '#f7eaef',
    icon: 'Film',
  },
  Lainnya: {
    label: 'Lainnya',
    color: '#8d877e',
    softColor: '#eeebe6',
    icon: 'MoreHorizontal',
  },
};

/**
 * Format angka ke Rupiah bersih: "Rp 25.000"
 */
export function formatRupiah(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${formatted}`;
}

/**
 * Muat transaksi untuk bulan yang sedang dipilih
 */
export async function loadExpensesForSelectedMonth(): Promise<void> {
  setIsLoadingExpenses(true);
  try {
    const items = await db.getExpensesForMonth(selectedMonth());
    setExpenses(items);
  } catch (error) {
    console.error('Gagal memuat transaksi:', error);
  } finally {
    setIsLoadingExpenses(false);
  }
}

/**
 * Tambah transaksi pengeluaran baru
 */
export async function addExpense(params: {
  amount: number;
  category: ExpenseCategory;
  note?: string;
  date?: string;
}): Promise<Expense> {
  const today = new Date().toISOString().split('T')[0];
  const expenseDate = params.date || today;

  const newExpense: Expense = {
    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    date: expenseDate,
    amount: params.amount,
    category: params.category,
    note: params.note ? params.note.trim() : undefined,
    updated_at: Date.now(),
    is_deleted: false,
    sync_status: 'pending',
  };

  await db.saveExpense(newExpense);

  // Jika tanggal transaksi berada di bulan yang sedang aktif dilihat, update state
  if (expenseDate.startsWith(selectedMonth())) {
    await loadExpensesForSelectedMonth();
  }

  await refreshPendingCount();
  // Trigger auto sync di background
  triggerSync();

  return newExpense;
}

/**
 * Update transaksi pengeluaran yang ada
 */
export async function updateExpense(expense: Expense): Promise<void> {
  const updated: Expense = {
    ...expense,
    updated_at: Date.now(),
    sync_status: 'pending',
  };
  await db.saveExpense(updated);
  await loadExpensesForSelectedMonth();
  await refreshPendingCount();
  triggerSync();
}

/**
 * Hapus transaksi (soft-delete)
 */
export async function deleteExpense(id: string): Promise<void> {
  await db.softDeleteExpense(id);
  await loadExpensesForSelectedMonth();
  await refreshPendingCount();
  triggerSync();
}

/**
 * State & modal dialog konfirmasi hapus catatan kustom
 */
const [expenseToDelete, setExpenseToDelete] = createSignal<Expense | null>(null);

export function requestDeleteExpense(expense: Expense): void {
  setExpenseToDelete(expense);
}

export function cancelDeleteExpense(): void {
  setExpenseToDelete(null);
}

export async function confirmDeleteExpense(): Promise<void> {
  const exp = expenseToDelete();
  if (exp) {
    await deleteExpense(exp.id);
    setExpenseToDelete(null);
  }
}

export { expenseToDelete };

/**
 * Berpindah bulan (+1 atau -1)
 */
export async function changeMonth(deltaMonths: number): Promise<void> {
  const [yearStr, monthStr] = selectedMonth().split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + deltaMonths;

  if (month > 12) {
    year += 1;
    month = 1;
  } else if (month < 1) {
    year -= 1;
    month = 12;
  }

  const nextMonth = `${year}-${String(month).padStart(2, '0')}`;
  setSelectedMonth(nextMonth);
  await loadExpensesForSelectedMonth();
}

// DERIVED MEMOS

/**
 * Total pengeluaran khusus hari ini
 */
export const todayExpensesTotal = createMemo(() => {
  const todayStr = new Date().toISOString().split('T')[0];
  return expenses()
    .filter((item) => item.date === todayStr)
    .reduce((sum, item) => sum + item.amount, 0);
});

/**
 * Total pengeluaran bulan berjalan
 */
export const totalMonthlyExpense = createMemo(() => {
  return expenses().reduce((sum, item) => sum + item.amount, 0);
});

/**
 * Rata-rata pengeluaran per hari
 */
export const dailyAverageExpense = createMemo(() => {
  const total = totalMonthlyExpense();
  if (total === 0) return 0;

  const [year, month] = selectedMonth().split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Jika bulan sekarang, hitung rata-rata sampai hari ini
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const divisor = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

  return Math.round(total / divisor);
});

/**
 * Ringkasan breakdown per kategori
 */
export const categoryBreakdown = createMemo<CategorySummary[]>(() => {
  const items = expenses();
  const total = totalMonthlyExpense();
  const categoryMap: Partial<Record<ExpenseCategory, number>> = {};

  items.forEach((item) => {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
  });

  const list: CategorySummary[] = Object.keys(CATEGORY_CONFIG).map((catKey) => {
    const cat = catKey as ExpenseCategory;
    const catTotal = categoryMap[cat] || 0;
    const pct = total > 0 ? Math.round((catTotal / total) * 100) : 0;
    return {
      category: cat,
      total: catTotal,
      percentage: pct,
      color: CATEGORY_CONFIG[cat].color,
      softColor: CATEGORY_CONFIG[cat].softColor,
    };
  });

  return list.sort((a, b) => b.total - a.total);
});

/**
 * Daftar transaksi yang dikelompokkan per tanggal
 */
export interface DateGroupedExpense {
  date: string;
  formattedDate: string;
  totalDay: number;
  items: Expense[];
}

export const groupedExpenses = createMemo<DateGroupedExpense[]>(() => {
  const items = expenses();
  const groups: Record<string, Expense[]> = {};

  items.forEach((item) => {
    if (!groups[item.date]) {
      groups[item.date] = [];
    }
    groups[item.date].push(item);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map((dateKey) => {
      const dayItems = groups[dateKey];
      const totalDay = dayItems.reduce((acc, curr) => acc + curr.amount, 0);

      let formattedDate = dateKey;
      if (dateKey === todayStr) {
        formattedDate = 'Hari ini';
      } else if (dateKey === yesterday) {
        formattedDate = 'Kemarin';
      } else {
        const d = new Date(dateKey);
        formattedDate = d.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
      }

      return {
        date: dateKey,
        formattedDate,
        totalDay,
        items: dayItems,
      };
    });
});

export { selectedMonth, expenses, isLoadingExpenses };

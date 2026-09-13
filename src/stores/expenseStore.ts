import { createSignal, createMemo } from 'solid-js';
import { db } from '../services/db';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { triggerSync, refreshPendingCount } from '../services/sync/syncManager';
import { categories, getCategoryConfig } from './categoryStore';
import { settings } from './settingsStore';

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

// Konfigurasi Kategori & Warna Soft (Warmgrey)
export const CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; color: string; softColor: string; icon: string }
> = {
  Makanan: {
    label: 'Makanan',
    color: '#6b635b',
    softColor: '#e8e4df',
    icon: 'Utensils',
  },
  Transportasi: {
    label: 'Transportasi',
    color: '#6b635b',
    softColor: '#e8e4df',
    icon: 'Car',
  },
  Transport: {
    label: 'Transportasi',
    color: '#6b635b',
    softColor: '#e8e4df',
    icon: 'Car',
  },
  Belanja: {
    label: 'Belanja',
    color: '#6b635b',
    softColor: '#e8e4df',
    icon: 'ShoppingBag',
  },
  Tagihan: {
    label: 'Tagihan',
    color: '#6b635b',
    softColor: '#e8e4df',
    icon: 'Receipt',
  },
  Hiburan: {
    label: 'Hiburan',
    color: '#6b635b',
    softColor: '#e8e4df',
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

export interface DynamicBudgetCalculation {
  totalMonthlyIncome: number;
  spentBeforeToday: number;
  remainingBalanceBeforeToday: number;
  daysRemaining: number;
  totalDaysInMonth: number;
  currentDay: number;
  calculatedDailyBudget: number;
  spentToday: number;
  remainingToday: number;
  isOverBudget: boolean;
  excessAmount: number;
}

/**
 * Fungsi kalkulasi murni untuk budget harian dinamis
 */
export function calculateDynamicDailyBudget(params: {
  monthlyIncome: number;
  expenses: Expense[];
  now?: Date;
}): DynamicBudgetCalculation {
  const now = params.now || new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Sisa hari termasuk hari ini (misal tgl 15 di bulan 30 hari -> 16 hari tersisa)
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${year}-${pad(month)}-${pad(currentDay)}`;

  let spentBeforeToday = 0;
  let spentToday = 0;

  params.expenses.forEach((item) => {
    if (item.is_deleted) return;

    if (item.date < todayStr || (item.date === todayStr && item.note === 'pengeluaran terakhir')) {
      spentBeforeToday += item.amount;
    } else if (item.date === todayStr) {
      spentToday += item.amount;
    }
  });

  const totalMonthlyIncome = params.monthlyIncome || 0;
  const remainingBalanceBeforeToday = Math.max(0, totalMonthlyIncome - spentBeforeToday);

  const calculatedDailyBudget =
    daysRemaining > 0 ? Math.round(remainingBalanceBeforeToday / daysRemaining) : 0;

  const remainingToday = calculatedDailyBudget - spentToday;
  const isOverBudget = spentToday > calculatedDailyBudget;
  const excessAmount = Math.max(0, spentToday - calculatedDailyBudget);

  return {
    totalMonthlyIncome,
    spentBeforeToday,
    remainingBalanceBeforeToday,
    daysRemaining,
    totalDaysInMonth,
    currentDay,
    calculatedDailyBudget,
    spentToday,
    remainingToday,
    isOverBudget,
    excessAmount,
  };
}

/**
 * State reaktif informasi budget harian dinamis
 */
export const dynamicDailyBudgetInfo = createMemo<DynamicBudgetCalculation>(() => {
  const currentIncome = settings().monthlyIncome || 0;
  return calculateDynamicDailyBudget({
    monthlyIncome: currentIncome,
    expenses: expenses(),
  });
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
  const categoryMap: Record<string, number> = {};

  items.forEach((item) => {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
  });

  // Gabungkan semua kategori terdaftar + kategori yang mungkin ada di transaksi tapi belum ada di list
  const knownCatNames = new Set(categories().map((c) => c.name));
  const allCatNames = [...categories().map((c) => c.name)];

  Object.keys(categoryMap).forEach((name) => {
    if (!knownCatNames.has(name)) {
      allCatNames.push(name);
    }
  });

  const list: CategorySummary[] = allCatNames.map((catName) => {
    const catTotal = categoryMap[catName] || 0;
    const pct = total > 0 ? Math.round((catTotal / total) * 100) : 0;
    const config = getCategoryConfig(catName);
    return {
      category: catName,
      total: catTotal,
      percentage: pct,
      color: config.color,
      softColor: config.softColor,
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

import { createSignal, createMemo } from 'solid-js';
import { db } from '../services/db';
import { Expense, ExpenseCategory, CategorySummary } from '../types';
import { triggerSync, refreshPendingCount } from '../services/sync/syncManager';
import { categories, getCategoryConfig } from './categoryStore';
import { settings } from './settingsStore';

// Default bulan saat ini: YYYY-MM
export const getCurrentYearMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// State Signals
// selectedMonth: bulan yang sedang aktif dilihat di tab Rekap
const [selectedMonth, setSelectedMonth] = createSignal<string>(getCurrentYearMonth());
// currentMonthExpenses: transaksi di bulan berjalan (selalu sinkron untuk tab Catat & Daily Budget)
const [currentMonthExpenses, setCurrentMonthExpenses] = createSignal<Expense[]>([]);
// recapExpenses: transaksi khusus bulan yang dipilih di tab Rekap
const [recapExpenses, setRecapExpenses] = createSignal<Expense[]>([]);
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
 * Format angka ke Rupiah bersih: "Rp 25.000" atau "-Rp 10.000" jika minus
 */
export function formatRupiah(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const formatted = absAmount
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Parsing berbagai format nominal input atau Google Sheets menjadi angka murni (number).
 * Mendukung: angka murni, "Rp 20.000", "20rb", "20k", "20ribu", "1.5jt", "20.000", dll.
 */
export function parseAmount(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val);
  }

  let str = String(val).trim();
  if (!str) return 0;

  // Bersihkan prefix mata uang seperti "Rp", "Rp.", "IDR", "$", dan spasi awal
  str = str.replace(/^(rp\.?|idr|\$)\s*/i, '').trim();

  // Cek apakah ada suffix "jt", "juta", "m"
  const jtMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:jt|juta|m)$/i);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1000000);
  }

  // Cek apakah ada suffix "rb", "ribu", "k"
  const rbMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:rb|ribu|k)$/i);
  if (rbMatch) {
    const num = parseFloat(rbMatch[1].replace(',', '.'));
    return isNaN(num) ? 0 : Math.round(num * 1000);
  }

  // Tangani titik & koma ribuan vs desimal
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Format Indonesia: 20.000,50 -> buang titik, jadikan koma sebagai titik desimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Format US: 20,000.50 -> buang koma
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Parsing tanggal dari Google Sheet, mendukung string 'YYYY-MM-DD' maupun serial number Google Sheets (misal 46235 -> 2026-08-01)
 */
export function parseSheetDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number' || /^\d{5}$/.test(String(val).trim())) {
    const serial = Number(val);
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str;
}

/**
 * Muat transaksi untuk bulan berjalan dan bulan yang sedang dipilih
 */
export async function loadExpensesForSelectedMonth(): Promise<void> {
  setIsLoadingExpenses(true);
  try {
    const currentYM = getCurrentYearMonth();
    const selYM = selectedMonth();

    // 1. Selalu muat data bulan berjalan (untuk Tab Catat & Daily Budget)
    const currentItems = await db.getExpensesForMonth(currentYM);
    setCurrentMonthExpenses(currentItems);

    // 2. Muat data bulan rekap yang dipilih
    if (selYM === currentYM) {
      setRecapExpenses(currentItems);
    } else {
      const recapItems = await db.getExpensesForMonth(selYM);
      setRecapExpenses(recapItems);
    }
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

  const currentYM = getCurrentYearMonth();
  const selYM = selectedMonth();

  // Selalu perbarui state bulan berjalan jika transaksi terjadi di bulan ini
  if (expenseDate.startsWith(currentYM)) {
    const currentItems = await db.getExpensesForMonth(currentYM);
    setCurrentMonthExpenses(currentItems);
  }

  // Jika transaksi juga berada di bulan yang sedang dilihat di tab rekap, perbarui juga
  if (expenseDate.startsWith(selYM)) {
    if (selYM === currentYM) {
      setRecapExpenses(currentMonthExpenses());
    } else {
      const recapItems = await db.getExpensesForMonth(selYM);
      setRecapExpenses(recapItems);
    }
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
 * Berpindah bulan (+1 atau -1) khusus untuk tab Rekap
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

  setIsLoadingExpenses(true);
  try {
    const currentYM = getCurrentYearMonth();
    if (nextMonth === currentYM) {
      const items = await db.getExpensesForMonth(nextMonth);
      setRecapExpenses(items);
      setCurrentMonthExpenses(items);
    } else {
      const items = await db.getExpensesForMonth(nextMonth);
      setRecapExpenses(items);
    }
  } catch (error) {
    console.error('Gagal memuat transaksi rekap:', error);
  } finally {
    setIsLoadingExpenses(false);
  }
}

// DERIVED MEMOS

/**
 * Total pengeluaran khusus hari ini
 */
export const todayExpensesTotal = createMemo(() => {
  const todayStr = new Date().toISOString().split('T')[0];
  return currentMonthExpenses()
    .filter((item) => item.date === todayStr)
    .reduce((sum, item) => sum + item.amount, 0);
});

export interface DynamicBudgetCalculation {
  totalMonthlyIncome: number;
  spentBeforeToday: number;
  untrackedPriorExpense?: number;
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
  initialBalance?: number;
  initialBalanceMonth?: string;
}): DynamicBudgetCalculation {
  const now = params.now || new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Sisa hari termasuk hari ini (misal tgl 15 di bulan 30 hari -> 16 hari tersisa)
  const daysRemaining = Math.max(1, totalDaysInMonth - currentDay + 1);

  const pad = (n: number) => String(n).padStart(2, '0');
  const yearMonthStr = `${year}-${pad(month)}`;
  const todayStr = `${yearMonthStr}-${pad(currentDay)}`;

  let spentBeforeToday = 0;
  let spentToday = 0;

  params.expenses.forEach((item) => {
    if (item.is_deleted) return;

    // Abaikan catatan dummy pengeluaran terakhir jika ada
    if (item.note === 'pengeluaran terakhir') return;

    // Pastikan hanya menghitung pengeluaran di bulan berjalan
    if (!item.date.startsWith(yearMonthStr)) return;

    if (item.date < todayStr) {
      spentBeforeToday += item.amount;
    } else if (item.date === todayStr) {
      spentToday += item.amount;
    }
  });

  const totalMonthlyIncome = params.monthlyIncome || 0;

  // Cek apakah ada pengeluaran sebelum onboarding (hanya berlaku pada bulan onboarding)
  let untrackedPriorExpense = 0;
  if (
    params.initialBalance !== undefined &&
    params.initialBalance > 0 &&
    (!params.initialBalanceMonth || params.initialBalanceMonth === yearMonthStr)
  ) {
    if (totalMonthlyIncome > params.initialBalance) {
      untrackedPriorExpense = totalMonthlyIncome - params.initialBalance;
    }
  }

  const remainingBalanceBeforeToday = Math.max(
    0,
    totalMonthlyIncome - untrackedPriorExpense - spentBeforeToday
  );

  const calculatedDailyBudget =
    daysRemaining > 0 ? Math.round(remainingBalanceBeforeToday / daysRemaining) : 0;

  const remainingToday = calculatedDailyBudget - spentToday;
  const isOverBudget = spentToday > calculatedDailyBudget;
  const excessAmount = Math.max(0, spentToday - calculatedDailyBudget);

  return {
    totalMonthlyIncome,
    spentBeforeToday,
    untrackedPriorExpense,
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
 * State reaktif informasi budget harian dinamis (selalu menggunakan data bulan berjalan)
 */
export const dynamicDailyBudgetInfo = createMemo<DynamicBudgetCalculation>(() => {
  const currentIncome = settings().monthlyIncome || 0;
  const initBal = settings().initialBalance ?? settings().currentBalance;
  const initMonth = settings().initialBalanceMonth;
  return calculateDynamicDailyBudget({
    monthlyIncome: currentIncome,
    expenses: currentMonthExpenses(),
    initialBalance: initBal,
    initialBalanceMonth: initMonth,
  });
});

/**
 * Total pengeluaran bulan yang dipilih di tab Rekap
 */
export const totalMonthlyExpense = createMemo(() => {
  return recapExpenses().reduce((sum, item) => sum + item.amount, 0);
});

/**
 * Rata-rata pengeluaran per hari untuk bulan rekap
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
 * Ringkasan breakdown per kategori untuk bulan rekap
 */
export const categoryBreakdown = createMemo<CategorySummary[]>(() => {
  const items = recapExpenses();
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
 * Daftar transaksi yang dikelompokkan per tanggal (khusus tab Rekap)
 */
export interface DateGroupedExpense {
  date: string;
  formattedDate: string;
  totalDay: number;
  items: Expense[];
}

export const groupedExpenses = createMemo<DateGroupedExpense[]>(() => {
  const items = recapExpenses();
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

/**
 * Daftar transaksi khusus hari ini (untuk tab Catat)
 */
export const todayGroupedExpenses = createMemo<DateGroupedExpense[]>(() => {
  const todayStr = new Date().toISOString().split('T')[0];
  const items = currentMonthExpenses().filter((item) => item.date === todayStr);
  if (items.length === 0) return [];

  const totalDay = items.reduce((acc, curr) => acc + curr.amount, 0);
  return [
    {
      date: todayStr,
      formattedDate: 'Hari ini',
      totalDay,
      items,
    },
  ];
});

// Backward compatibility alias
const expenses = recapExpenses;

export {
  selectedMonth,
  expenses,
  currentMonthExpenses,
  recapExpenses,
  isLoadingExpenses,
};

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/services/db';
import {
  selectedMonth,
  changeMonth,
  addExpense,
  loadExpensesForSelectedMonth,
  currentMonthExpenses,
  recapExpenses,
  todayGroupedExpenses,
  getCurrentYearMonth,
} from '../src/stores/expenseStore';

describe('Isolasi Bulan Tab Catat vs Tab Rekap', () => {
  beforeEach(async () => {
    // Bersihkan db expenses
    await db.expenses.clear();
    await loadExpensesForSelectedMonth();
  });

  it('menambah catatan baru hari ini tetap berhasil meskipun tab rekap sedang melihat bulan lalu', async () => {
    // 1. Initial state: berada di bulan berjalan (e.g. 2026-09)
    const currentYM = getCurrentYearMonth();
    expect(selectedMonth()).toBe(currentYM);

    // 2. Simulasi pengguna berpindah ke bulan lalu di tab Rekap (-1 bulan)
    await changeMonth(-1);
    expect(selectedMonth()).not.toBe(currentYM);
    const prevMonth = selectedMonth();

    // 3. Tambah catatan transaksi di tab Catat untuk hari ini
    const today = new Date().toISOString().split('T')[0];
    const newExp = await addExpense({
      amount: 25000,
      category: 'Makanan',
      note: 'Nasi goreng siang',
      date: today,
    });

    // 4. Pastikan transaksi masuk ke database
    const savedInDb = await db.expenses.get(newExp.id);
    expect(savedInDb).toBeDefined();
    expect(savedInDb?.amount).toBe(25000);

    // 5. Pastikan currentMonthExpenses dan todayGroupedExpenses langsung ter-update
    expect(currentMonthExpenses().some((item) => item.id === newExp.id)).toBe(true);
    const todayGroups = todayGroupedExpenses();
    expect(todayGroups.length).toBe(1);
    expect(todayGroups[0].totalDay).toBe(25000);
    expect(todayGroups[0].items[0].note).toBe('Nasi goreng siang');

    // 6. Pastikan tab Rekap masih memegang bulan lalu tanpa error
    expect(selectedMonth()).toBe(prevMonth);
  });
});

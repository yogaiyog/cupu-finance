import { describe, it, expect } from 'vitest';
import { calculateDynamicDailyBudget } from '../src/stores/expenseStore';
import { Expense } from '../src/types';

describe('calculateDynamicDailyBudget', () => {
  it('menghitung budget harian dinamis secara akurat', () => {
    // Simulasi tanggal 15 dari bulan 30 hari (sisa 16 hari termasuk hari ini)
    const mockNow = new Date('2026-09-15T12:00:00');
    const income = 3000000;
    const expenses: Expense[] = [
      // Belanja sebelum tgl 15: total 1.400.000
      {
        id: '1',
        date: '2026-09-02',
        amount: 500000,
        category: 'Belanja',
        updated_at: 1,
        is_deleted: false,
        sync_status: 'synced',
      },
      {
        id: '2',
        date: '2026-09-10',
        amount: 900000,
        category: 'Makanan',
        updated_at: 2,
        is_deleted: false,
        sync_status: 'synced',
      },
      // Belanja hari ini (tgl 15): 40.000
      {
        id: '3',
        date: '2026-09-15',
        amount: 40000,
        category: 'Makanan',
        updated_at: 3,
        is_deleted: false,
        sync_status: 'synced',
      },
    ];

    const result = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses,
      now: mockNow,
    });

    // Sisa uang sebelum hari ini = 3.000.000 - 1.400.000 = 1.600.000
    // Sisa hari = 30 - 15 + 1 = 16 hari
    // Budget hari ini = 1.600.000 / 16 = 100.000
    expect(result.remainingBalanceBeforeToday).toBe(1600000);
    expect(result.daysRemaining).toBe(16);
    expect(result.calculatedDailyBudget).toBe(100000);
    expect(result.spentToday).toBe(40000);
    expect(result.remainingToday).toBe(60000);
    expect(result.isOverBudget).toBe(false);
  });

  it('mendeteksi overbudget saat belanja hari ini melebihi jatah harian', () => {
    const mockNow = new Date('2026-09-15T12:00:00');
    const income = 3000000;
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2026-09-02',
        amount: 1400000,
        category: 'Belanja',
        updated_at: 1,
        is_deleted: false,
        sync_status: 'synced',
      },
      // Belanja hari ini 150.000 (budget 100.000)
      {
        id: '2',
        date: '2026-09-15',
        amount: 150000,
        category: 'Makanan',
        updated_at: 2,
        is_deleted: false,
        sync_status: 'synced',
      },
    ];

    const result = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses,
      now: mockNow,
    });

    expect(result.calculatedDailyBudget).toBe(100000);
    expect(result.spentToday).toBe(150000);
    expect(result.isOverBudget).toBe(true);
    expect(result.excessAmount).toBe(50000);
    expect(result.remainingToday).toBe(-50000);
  });

  it('keesokan harinya budget harian otomatis berkurang karena overbudget kemarin', () => {
    // Hari berikutnya: tgl 16 (sisa 15 hari)
    const mockTomorrow = new Date('2026-09-16T12:00:00');
    const income = 3000000;
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2026-09-02',
        amount: 1400000,
        category: 'Belanja',
        updated_at: 1,
        is_deleted: false,
        sync_status: 'synced',
      },
      // Kemarin tgl 15 belanja 150.000 (over 50rb)
      {
        id: '2',
        date: '2026-09-15',
        amount: 150000,
        category: 'Makanan',
        updated_at: 2,
        is_deleted: false,
        sync_status: 'synced',
      },
    ];

    const resultTomorrow = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses,
      now: mockTomorrow,
    });

    // Total belanja sebelum tgl 16 = 1.400.000 + 150.000 = 1.550.000
    // Sisa uang sebelum tgl 16 = 3.000.000 - 1.550.000 = 1.450.000
    // Sisa hari = 30 - 16 + 1 = 15 hari
    // Budget baru = 1.450.000 / 15 = 96.667 (berkurang dari 100.000!)
    expect(resultTomorrow.remainingBalanceBeforeToday).toBe(1450000);
    expect(resultTomorrow.daysRemaining).toBe(15);
    expect(resultTomorrow.calculatedDailyBudget).toBe(Math.round(1450000 / 15));
    expect(resultTomorrow.calculatedDailyBudget).toBeLessThan(100000);
  });
});

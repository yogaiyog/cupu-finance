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

  it('menghitung budget dari initialBalance saat onboard di tengah bulan tanpa transaksi dummy', () => {
    // Simulasi user onboard tanggal 15 September: gaji 5.000.000 tapi sisa uang 2.000.000
    const mockNow = new Date('2026-09-15T12:00:00');
    const income = 5000000;
    const initialBalance = 2000000;
    const initialBalanceMonth = '2026-09';

    // Tidak ada transaksi dummy "Lainnya - pengeluaran terakhir" sama sekali!
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2026-09-15',
        amount: 25000,
        category: 'Makanan',
        updated_at: 1,
        is_deleted: false,
        sync_status: 'synced',
      },
    ];

    const result = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses,
      now: mockNow,
      initialBalance,
      initialBalanceMonth,
    });

    // Sisa hari = 30 - 15 + 1 = 16 hari
    // Dana yang tersedia = 2.000.000 (bukan 5.000.000)
    // Budget hari ini = 2.000.000 / 16 = 125.000
    expect(result.untrackedPriorExpense).toBe(3000000);
    expect(result.remainingBalanceBeforeToday).toBe(2000000);
    expect(result.daysRemaining).toBe(16);
    expect(result.calculatedDailyBudget).toBe(125000);
    expect(result.spentToday).toBe(25000);
    expect(result.remainingToday).toBe(100000);

    // Keesokan harinya (16 Sept)
    const mockTomorrow = new Date('2026-09-16T12:00:00');
    const resultTomorrow = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses,
      now: mockTomorrow,
      initialBalance,
      initialBalanceMonth,
    });

    // Sisa hari = 15 hari
    // Sisa dana = 2.000.000 - 25.000 = 1.975.000
    // Budget tgl 16 = 1.975.000 / 15 = 131.667
    expect(resultTomorrow.remainingBalanceBeforeToday).toBe(1975000);
    expect(resultTomorrow.daysRemaining).toBe(15);
    expect(resultTomorrow.calculatedDailyBudget).toBe(Math.round(1975000 / 15));

    // Bulan berikutnya (1 Oktober): initialBalance bulan Sept sudah tidak berlaku, kembali ke gaji utuh
    const mockNextMonth = new Date('2026-10-01T12:00:00');
    const resultNextMonth = calculateDynamicDailyBudget({
      monthlyIncome: income,
      expenses: [],
      now: mockNextMonth,
      initialBalance,
      initialBalanceMonth,
    });

    expect(resultNextMonth.untrackedPriorExpense).toBe(0);
    expect(resultNextMonth.remainingBalanceBeforeToday).toBe(5000000);
    expect(resultNextMonth.daysRemaining).toBe(31);
    expect(resultNextMonth.calculatedDailyBudget).toBe(Math.round(5000000 / 31));
  });
});

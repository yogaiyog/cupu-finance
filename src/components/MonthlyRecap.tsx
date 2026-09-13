import { Component, For, Show } from 'solid-js';
import {
  selectedMonth,
  changeMonth,
  totalMonthlyExpense,
  dailyAverageExpense,
  categoryBreakdown,
  formatRupiah,
} from '../stores/expenseStore';
import { ExpenseList } from './ExpenseList';
import { settings } from '../stores/settingsStore';
import { ChevronLeft, ChevronRight, PieChart } from 'lucide-solid';

export const MonthlyRecap: Component = () => {
  // Format tampilan bulan: "September 2026"
  const formattedMonthTitle = () => {
    const [year, month] = selectedMonth().split('-').map(Number);
    const dateObj = new Date(year, month - 1, 1);
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  return (
    <div class="w-full pb-8">
      {/* SELECTOR BULAN */}
      <div class="flex items-center justify-between bg-warm-card border border-warm-border rounded-2xl p-3 mb-4 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <button
          onClick={() => changeMonth(-1)}
          class="p-2 text-warm-mute hover:text-warm-ink hover:bg-warm-subtle rounded-xl transition-all active:scale-95"
          title="Bulan sebelumnya"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>

        <h2 class="text-base font-bold text-warm-ink capitalize tracking-tight">
          {formattedMonthTitle()}
        </h2>

        <button
          onClick={() => changeMonth(1)}
          class="p-2 text-warm-mute hover:text-warm-ink hover:bg-warm-subtle rounded-xl transition-all active:scale-95"
          title="Bulan berikutnya"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>

      {/* KARTU RINGKASAN TOTAL */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-5 mb-5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <span class="text-xs font-semibold text-warm-mute uppercase tracking-wider block mb-1">
          Total Pengeluaran
        </span>
        <div class="text-3xl font-extrabold text-warm-ink tracking-tight tabular-nums mb-3">
          {formatRupiah(totalMonthlyExpense())}
        </div>

        <div class="pt-3 border-t border-warm-border/60 flex items-center justify-between text-xs text-warm-mute">
          <span>Rata-rata per hari:</span>
          <span class="font-semibold text-warm-ink tabular-nums">
            {formatRupiah(dailyAverageExpense())} / hari
          </span>
        </div>

        <Show when={settings().dailyBudget}>
          <div class="pt-1.5 flex items-center justify-between text-xs">
            <span class="text-warm-mute">Target batas harian:</span>
            <span class="font-semibold text-warm-primary tabular-nums">
              {formatRupiah(settings().dailyBudget!)} / hari
            </span>
          </div>
        </Show>
      </div>

      {/* BREAKDOWN PER KATEGORI (CSS BAR RINGAN) */}
      <Show when={totalMonthlyExpense() > 0}>
        <div class="bg-warm-card border border-warm-border rounded-2xl p-5 mb-6 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
          <div class="flex items-center gap-2 mb-4">
            <PieChart class="w-4 h-4 text-warm-mute" />
            <h3 class="text-sm font-bold text-warm-ink">Rincian Kategori</h3>
          </div>

          <div class="space-y-3.5">
            <For each={categoryBreakdown().filter((c) => c.total > 0)}>
              {(item) => (
                <div>
                  <div class="flex items-center justify-between text-xs font-semibold mb-1">
                    <span class="text-warm-ink flex items-center gap-1.5">
                      <span
                        class="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ 'background-color': item.color }}
                      ></span>
                      {item.category}
                    </span>
                    <span class="text-warm-mute tabular-nums">
                      {formatRupiah(item.total)} ({item.percentage}%)
                    </span>
                  </div>

                  {/* Progress Bar Proporsional */}
                  <div class="w-full h-2 bg-warm-subtle rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${item.percentage}%`,
                        'background-color': item.color,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* RIWAYAT TRANSAKSI BULAN INI */}
      <div class="mt-2">
        <h3 class="text-xs font-bold text-warm-mute uppercase tracking-wider px-1 mb-3">
          Riwayat Transaksi Harian
        </h3>
        <ExpenseList />
      </div>
    </div>
  );
};

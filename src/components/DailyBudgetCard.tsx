import { Component, Show } from 'solid-js';
import { settings } from '../stores/settingsStore';
import { expenses, formatRupiah } from '../stores/expenseStore';
import { AlertCircle } from 'lucide-solid';

export const DailyBudgetCard: Component = () => {
  const hasBudget = () => !!(settings().dailyBudget && settings().dailyBudget! > 0);
  const dailyBudget = () => settings().dailyBudget || 0;
  // Pengeluaran belanja aktif hari ini (catatan awal 'pengeluaran terakhir' tidak memicu kelebihan batas harian)
  const spentToday = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return expenses()
      .filter((item) => item.date === todayStr && item.note !== 'pengeluaran terakhir')
      .reduce((sum, item) => sum + item.amount, 0);
  };
  const isOverBudget = () => spentToday() > dailyBudget();
  const excessAmount = () => Math.max(0, spentToday() - dailyBudget());

  return (
    <Show when={hasBudget()}>
      <div class="flex items-center justify-between px-3.5 py-2.5 bg-warm-card border border-warm-border rounded-xl mb-3 shadow-[0_1px_2px_rgba(45,40,37,0.03)] text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-warm-mute font-medium">Budget hari ini:</span>
          <strong class="text-warm-ink font-bold tabular-nums">
            {formatRupiah(dailyBudget())}
          </strong>
        </div>

        <Show when={isOverBudget()}>
          <div class="flex items-center gap-1 text-cat-bills font-bold tabular-nums bg-cat-bills-soft px-2 py-0.5 rounded-lg border border-cat-bills/20">
            <AlertCircle class="w-3.5 h-3.5 shrink-0" />
            <span>Kelebihan: {formatRupiah(excessAmount())}</span>
          </div>
        </Show>
      </div>
    </Show>
  );
};

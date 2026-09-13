import { Component, For, Show } from 'solid-js';
import { groupedExpenses, formatRupiah, isLoadingExpenses } from '../stores/expenseStore';
import { ExpenseItem } from './ExpenseItem';
import { Inbox } from 'lucide-solid';

interface ExpenseListProps {
  todayOnly?: boolean;
}

export const ExpenseList: Component<ExpenseListProps> = (props) => {
  const displayGroups = () => {
    const all = groupedExpenses();
    if (props.todayOnly) {
      const todayStr = new Date().toISOString().split('T')[0];
      return all.filter((g) => g.date === todayStr);
    }
    return all;
  };

  return (
    <div class="w-full">
      <Show when={isLoadingExpenses()}>
        <div class="py-8 text-center text-warm-mute text-sm">
          Memuat riwayat pengeluaran...
        </div>
      </Show>

      <Show when={!isLoadingExpenses() && displayGroups().length === 0}>
        <div class="flex flex-col items-center justify-center py-10 px-4 text-center bg-warm-card/60 border border-dashed border-warm-border rounded-2xl">
          <div class="p-3 rounded-full bg-warm-subtle text-warm-mute mb-3">
            <Inbox class="w-6 h-6" />
          </div>
          <p class="text-sm font-medium text-warm-ink">
            {props.todayOnly ? 'Belum ada pengeluaran hari ini' : 'Belum ada pengeluaran di bulan ini'}
          </p>
          <p class="text-xs text-warm-mute mt-1">
            {props.todayOnly
              ? 'Pengeluaran yang kamu catat hari ini akan tampil di sini.'
              : 'Catat pengeluaran harian Anda dengan form di atas.'}
          </p>
        </div>
      </Show>

      <For each={displayGroups()}>
        {(group) => (
          <div class="mb-5">
            {/* Header Tanggal & Total Hari */}
            <div class="flex items-center justify-between px-1 mb-2">
              <span class="text-xs font-semibold text-warm-mute uppercase tracking-wider">
                {group.formattedDate}
              </span>
              <span class="text-xs font-semibold text-warm-ink tabular-nums">
                {formatRupiah(group.totalDay)}
              </span>
            </div>

            {/* List Item pada Tanggal Ini */}
            <For each={group.items}>
              {(expense) => <ExpenseItem expense={expense} />}
            </For>
          </div>
        )}
      </For>
    </div>
  );
};

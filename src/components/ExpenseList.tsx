import { Component, For, Show } from 'solid-js';
import {
  groupedExpenses,
  todayGroupedExpenses,
  formatRupiah,
  isLoadingExpenses,
} from '../stores/expenseStore';
import { ExpenseItem } from './ExpenseItem';

interface ExpenseListProps {
  todayOnly?: boolean;
}

export const ExpenseList: Component<ExpenseListProps> = (props) => {
  const displayGroups = () => {
    if (props.todayOnly) {
      return todayGroupedExpenses();
    }
    return groupedExpenses();
  };

  return (
    <div class="w-full">
      <Show when={isLoadingExpenses()}>
        <div class="py-8 text-center text-warm-mute text-sm">
          Memuat riwayat pengeluaran...
        </div>
      </Show>

      <Show when={!isLoadingExpenses() && displayGroups().length === 0}>
        <div class="py-6 text-center text-xs text-warm-mute">
          {props.todayOnly ? 'Belum ada pengeluaran hari ini' : 'Belum ada pengeluaran di bulan ini'}
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

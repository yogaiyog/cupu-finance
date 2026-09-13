import { Component, Show } from 'solid-js';
import { Expense } from '../types';
import { formatRupiah, requestDeleteExpense } from '../stores/expenseStore';
import { getCategoryConfig } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import { Trash2 } from 'lucide-solid';

interface ExpenseItemProps {
  expense: Expense;
}

export const ExpenseItem: Component<ExpenseItemProps> = (props) => {
  const config = () => getCategoryConfig(props.expense.category);

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    requestDeleteExpense(props.expense);
  };

  return (
    <div class="flex items-center justify-between p-3 bg-warm-card border border-warm-border rounded-xl mb-1.5 shadow-[0_1px_2px_rgba(45,40,37,0.02)] hover:border-warm-primary transition-colors">
      <div class="flex items-center gap-2.5">
        {/* Ikon Kategori dengan soft background */}
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ 'background-color': config().softColor }}
        >
          <CategoryIcon name={config().icon} class="w-3.5 h-3.5" style={{ color: config().color }} />
        </div>

        {/* Keterangan */}
        <div class="flex flex-col">
          <span class="text-xs font-semibold text-warm-ink">
            {props.expense.category}
          </span>
          <Show when={props.expense.note}>
            <span class="text-[11px] text-warm-mute line-clamp-1">
              {props.expense.note}
            </span>
          </Show>
        </div>
      </div>

      {/* Nominal & Tombol Hapus */}
      <div class="flex items-center gap-2.5">
        <div class="flex flex-col items-end">
          <span class="text-sm font-bold text-warm-ink tabular-nums">
            {formatRupiah(props.expense.amount)}
          </span>
          {props.expense.sync_status === 'pending' && (
            <span class="text-[10px] text-sync-pending flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-sync-pending"></span>
              pending
            </span>
          )}
        </div>

        <button
          onClick={handleDelete}
          class="p-1.5 text-warm-faint hover:text-cat-bills transition-colors rounded-lg active:scale-90"
          title="Hapus"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

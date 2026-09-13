import { Component } from 'solid-js';
import { Expense } from '../types';
import { CATEGORY_CONFIG, formatRupiah, requestDeleteExpense } from '../stores/expenseStore';
import { Trash2, Utensils, Car, ShoppingBag, Receipt, Film, MoreHorizontal } from 'lucide-solid';

interface ExpenseItemProps {
  expense: Expense;
}

export const ExpenseItem: Component<ExpenseItemProps> = (props) => {
  const config = () => CATEGORY_CONFIG[props.expense.category] || CATEGORY_CONFIG.Lainnya;

  const renderIcon = () => {
    switch (props.expense.category) {
      case 'Makanan':
        return <Utensils class="w-4 h-4" style={{ color: config().color }} />;
      case 'Transport':
        return <Car class="w-4 h-4" style={{ color: config().color }} />;
      case 'Belanja':
        return <ShoppingBag class="w-4 h-4" style={{ color: config().color }} />;
      case 'Tagihan':
        return <Receipt class="w-4 h-4" style={{ color: config().color }} />;
      case 'Hiburan':
        return <Film class="w-4 h-4" style={{ color: config().color }} />;
      default:
        return <MoreHorizontal class="w-4 h-4" style={{ color: config().color }} />;
    }
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    requestDeleteExpense(props.expense);
  };

  return (
    <div class="flex items-center justify-between p-3.5 bg-warm-card border border-warm-border rounded-xl mb-2 shadow-[0_1px_2px_rgba(45,40,37,0.03)] hover:border-warm-primary transition-colors">
      <div class="flex items-center gap-3">
        {/* Ikon Kategori dengan soft background */}
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ 'background-color': config().softColor }}
        >
          {renderIcon()}
        </div>

        {/* Keterangan */}
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-warm-ink">
            {props.expense.category}
          </span>
          <span class="text-xs text-warm-mute line-clamp-1">
            {props.expense.note || 'Tanpa catatan'}
          </span>
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

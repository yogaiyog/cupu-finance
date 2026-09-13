import { Component, Show, createSignal } from 'solid-js';
import { settings } from '../stores/settingsStore';
import { dynamicDailyBudgetInfo, formatRupiah } from '../stores/expenseStore';
import { AlertCircle, HelpCircle, ChevronRight } from 'lucide-solid';
import { BudgetDetailModal } from './BudgetDetailModal';

export const DailyBudgetCard: Component = () => {
  const [showDetailModal, setShowDetailModal] = createSignal(false);
  const info = () => dynamicDailyBudgetInfo();

  // Memiliki budget jika penghasilan atau dailyBudget diatur > 0
  const hasBudget = () =>
    !!(
      (settings().monthlyIncome && settings().monthlyIncome! > 0) ||
      (settings().dailyBudget && settings().dailyBudget! > 0)
    );

  const budgetToShow = () => {
    // Jika monthlyIncome ada, gunakan kalkulasi dinamis
    if (settings().monthlyIncome && settings().monthlyIncome! > 0) {
      return info().calculatedDailyBudget;
    }
    // Fallback ke dailyBudget statis jika penghasilan belum diatur
    return settings().dailyBudget || 0;
  };

  const isOverBudget = () => {
    if (settings().monthlyIncome && settings().monthlyIncome! > 0) {
      return info().isOverBudget;
    }
    const currentBudget = settings().dailyBudget || 0;
    return info().spentToday > currentBudget;
  };

  const excessAmount = () => {
    if (settings().monthlyIncome && settings().monthlyIncome! > 0) {
      return info().excessAmount;
    }
    const currentBudget = settings().dailyBudget || 0;
    return Math.max(0, info().spentToday - currentBudget);
  };

  return (
    <Show when={hasBudget()}>
      <div
        onClick={() => setShowDetailModal(true)}
        class="flex items-center justify-between px-3.5 py-2.5 bg-warm-card border border-warm-border hover:border-warm-primary/60 rounded-xl mb-3 shadow-[0_1px_2px_rgba(45,40,37,0.03)] text-xs cursor-pointer transition-all active:scale-[0.99] group"
        title="Klik untuk melihat rincian kalkulasi budget"
      >
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-warm-mute font-medium">Budget hari ini:</span>
            <strong class="text-warm-ink font-bold tabular-nums">
              {formatRupiah(budgetToShow())}
            </strong>
          </div>
          <HelpCircle class="w-3.5 h-3.5 text-warm-faint group-hover:text-warm-primary transition-colors" />
        </div>

        <div class="flex items-center gap-2">
          <Show
            when={isOverBudget()}
            fallback={
              <span class="text-[10.5px] font-medium text-warm-mute group-hover:text-warm-ink transition-colors flex items-center gap-0.5">
                <span>Rincian</span>
                <ChevronRight class="w-3 h-3" />
              </span>
            }
          >
            <div class="flex items-center gap-1 text-cat-bills font-bold tabular-nums bg-cat-bills-soft px-2 py-0.5 rounded-lg border border-cat-bills/20">
              <AlertCircle class="w-3.5 h-3.5 shrink-0" />
              <span>Kelebihan: {formatRupiah(excessAmount())}</span>
            </div>
          </Show>
        </div>
      </div>

      <BudgetDetailModal
        isOpen={showDetailModal()}
        onClose={() => setShowDetailModal(false)}
      />
    </Show>
  );
};

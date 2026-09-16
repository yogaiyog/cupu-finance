import { Component, Show, createSignal } from 'solid-js';
import { settings } from '../stores/settingsStore';
import { dynamicDailyBudgetInfo, formatRupiah } from '../stores/expenseStore';
import { HelpCircle, ChevronRight } from 'lucide-solid';
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

  const budgetRemainingToShow = () => {
    // Jika monthlyIncome ada, gunakan kalkulasi dinamis (remainingToday = calculatedDailyBudget - spentToday)
    if (settings().monthlyIncome && settings().monthlyIncome! > 0) {
      return info().remainingToday;
    }
    // Fallback ke dailyBudget statis jika penghasilan belum diatur
    const baseBudget = settings().dailyBudget || 0;
    return baseBudget - info().spentToday;
  };

  const isMinus = () => budgetRemainingToShow() < 0;

  return (
    <Show when={hasBudget()}>
      <div
        onClick={() => setShowDetailModal(true)}
        class={`flex items-center justify-between px-3.5 py-2.5 bg-warm-card border ${
          isMinus()
            ? 'border-cat-bills/40 hover:border-cat-bills/80'
            : 'border-warm-border hover:border-warm-primary/60'
        } rounded-xl mb-3 shadow-[0_1px_2px_rgba(45,40,37,0.03)] text-xs cursor-pointer transition-all active:scale-[0.99] group`}
        title="Klik untuk melihat rincian kalkulasi budget"
      >
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1.5">
            <span class="text-warm-mute font-medium">Budget hari ini:</span>
            <strong
              class={`font-bold tabular-nums ${
                isMinus() ? 'text-cat-bills' : 'text-warm-ink'
              }`}
            >
              {formatRupiah(budgetRemainingToShow())}
            </strong>
          </div>
          <HelpCircle class="w-3.5 h-3.5 text-warm-faint group-hover:text-warm-primary transition-colors" />
        </div>

        <div class="flex items-center gap-1 text-[10.5px] font-medium text-warm-mute group-hover:text-warm-ink transition-colors">
          <span>Rincian</span>
          <ChevronRight class="w-3 h-3" />
        </div>
      </div>

      <BudgetDetailModal
        isOpen={showDetailModal()}
        onClose={() => setShowDetailModal(false)}
      />
    </Show>
  );
};

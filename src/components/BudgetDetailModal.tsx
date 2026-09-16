import { Component, Show } from 'solid-js';
import {
  dynamicDailyBudgetInfo,
  formatRupiah,
} from '../stores/expenseStore';
import { settings } from '../stores/settingsStore';
import {
  X,
  Calculator,
  Calendar,
  Wallet,
  TrendingDown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-solid';

interface BudgetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BudgetDetailModal: Component<BudgetDetailModalProps> = (props) => {
  const info = () => dynamicDailyBudgetInfo();
  const hasIncome = () => (settings().monthlyIncome || 0) > 0;

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div class="w-full max-w-sm bg-warm-card border border-warm-border rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="flex items-center justify-between pb-3 border-b border-warm-border/60">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-warm-primary/20 flex items-center justify-center text-warm-primary">
                <Calculator class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-warm-ink leading-tight">
                  Rincian Budget Harian
                </h3>
                <span class="text-[11px] text-warm-mute">
                  Kenapa budget hari ini segitu?
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="p-1 rounded-full text-warm-mute hover:text-warm-ink hover:bg-warm-subtle transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="mt-4 space-y-3.5 text-xs">
            {/* Card Besar: Hasil Budget Hari Ini */}
            <div class="p-3.5 bg-warm-canvas/70 border border-warm-border/70 rounded-xl text-center">
              <span class="text-[11px] font-semibold text-warm-mute block mb-1">
                Jatah Belanja Rekomendasi Hari Ini
              </span>
              <div class="text-2xl font-extrabold text-warm-ink tracking-tight tabular-nums">
                {formatRupiah(info().calculatedDailyBudget)}
              </div>
              <span class="text-[10.5px] text-warm-primary font-medium mt-0.5 inline-block">
                Otomatis dihitung ulang setiap hari
              </span>
            </div>

            {/* Step 1: Breakdown Dana */}
            <div class="space-y-2 p-3 bg-warm-canvas/40 border border-warm-border/50 rounded-xl">
              <div class="flex items-center justify-between">
                <span class="text-warm-mute flex items-center gap-1.5 font-medium">
                  <Wallet class="w-3.5 h-3.5 text-warm-primary" />
                  Target Dana Bulan Ini
                </span>
                <strong class="text-warm-ink tabular-nums">
                  {hasIncome() ? formatRupiah(info().totalMonthlyIncome) : 'Belum diatur'}
                </strong>
              </div>

              <Show when={(info().untrackedPriorExpense || 0) > 0}>
                <div class="flex items-center justify-between">
                  <span class="text-warm-mute flex items-center gap-1.5 font-medium pl-2 text-[11px]">
                    ↳ Sebelum gabung aplikasi
                  </span>
                  <span class="text-cat-bills font-medium tabular-nums text-[11px]">
                    - {formatRupiah(info().untrackedPriorExpense || 0)}
                  </span>
                </div>
              </Show>

              <div class="flex items-center justify-between">
                <span class="text-warm-mute flex items-center gap-1.5 font-medium">
                  <TrendingDown class="w-3.5 h-3.5 text-cat-bills" />
                  {(info().untrackedPriorExpense || 0) > 0
                    ? 'Tercatat di aplikasi s.d. kemarin'
                    : 'Terpakai s.d. kemarin'}
                </span>
                <span class="text-cat-bills font-bold tabular-nums">
                  - {formatRupiah(info().spentBeforeToday)}
                </span>
              </div>

              <div class="pt-2 border-t border-warm-border/50 flex items-center justify-between font-bold">
                <span class="text-warm-ink">Sisa Dana Tersisa</span>
                <span class="text-warm-ink tabular-nums">
                  = {formatRupiah(info().remainingBalanceBeforeToday)}
                </span>
              </div>
            </div>

            {/* Step 2: Pembagian Sisa Hari */}
            <div class="p-3 bg-warm-canvas/40 border border-warm-border/50 rounded-xl space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-warm-mute flex items-center gap-1.5 font-medium">
                  <Calendar class="w-3.5 h-3.5 text-warm-primary" />
                  Sisa Hari Bulan Ini
                </span>
                <strong class="text-warm-ink">
                  {info().daysRemaining} hari lagi
                </strong>
              </div>

              <div class="text-[11px] text-warm-mute pl-5">
                (Dari tanggal {info().currentDay} sampai akhir bulan tgl {info().totalDaysInMonth})
              </div>

              {/* Formula */}
              <div class="mt-2 p-2 bg-warm-subtle/70 rounded-lg text-center font-mono text-[11px] text-warm-ink font-semibold border border-warm-border/40">
                {formatRupiah(info().remainingBalanceBeforeToday)} ÷ {info().daysRemaining} hari ={' '}
                <span class="text-warm-primary font-bold">
                  {formatRupiah(info().calculatedDailyBudget)} / hari
                </span>
              </div>
            </div>

            {/* Status Real-time Hari Ini */}
            <div
              class={`p-3 rounded-xl border flex items-center justify-between ${
                info().isOverBudget
                  ? 'bg-cat-bills-soft border-cat-bills/30 text-cat-bills'
                  : 'bg-warm-canvas/60 border-warm-border/60 text-warm-ink'
              }`}
            >
              <div class="flex items-center gap-2">
                {info().isOverBudget ? (
                  <AlertCircle class="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 class="w-4 h-4 text-sync-synced shrink-0" />
                )}
                <div>
                  <div class="font-bold text-xs">
                    {info().isOverBudget ? 'Overbudget Hari Ini' : 'Sisa Jatah Hari Ini'}
                  </div>
                  <div class="text-[11px] opacity-80">
                    Belanja hari ini: {formatRupiah(info().spentToday)}
                  </div>
                </div>
              </div>
              <strong
                class={`text-sm font-extrabold tabular-nums ${
                  info().isOverBudget ? 'text-cat-bills' : 'text-warm-ink'
                }`}
              >
                {formatRupiah(info().remainingToday)}
              </strong>
            </div>

            {/* Edukasi / Penjelasan Ramah */}
            <div class="p-3 bg-warm-primary/10 border border-warm-primary/20 rounded-xl flex items-start gap-2.5">
              <Sparkles class="w-4 h-4 text-warm-primary shrink-0 mt-0.5" />
              <p class="text-[11px] text-warm-mute leading-relaxed">
                <strong class="text-warm-ink">Cara kerja dinamis:</strong> Jika hari ini kamu belanja lebih hemat, sisa uangmu otomatis menambah jatah belanja esok hari! Sebaliknya jika hari ini overbudget, jatah esok harinya otomatis mengecil agar uangmu tetap cukup sampai akhir bulan.
              </p>
            </div>
          </div>

          <div class="mt-4">
            <button
              type="button"
              onClick={props.onClose}
              class="w-full py-2.5 text-xs font-bold text-warm-ink bg-warm-subtle hover:bg-warm-subtle/80 rounded-xl transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

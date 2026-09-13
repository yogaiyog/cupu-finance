import { Component, For, Show, createSignal, createMemo } from 'solid-js';
import {
  selectedMonth,
  changeMonth,
  totalMonthlyExpense,
  dailyAverageExpense,
  categoryBreakdown,
  groupedExpenses,
  formatRupiah,
  isLoadingExpenses,
} from '../stores/expenseStore';
import { ExpenseItem } from './ExpenseItem';
import { settings } from '../stores/settingsStore';
import { getCategoryConfig } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import {
  ChevronLeft,
  ChevronRight,
  PieChart,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Inbox,
} from 'lucide-solid';

export const MonthlyRecap: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [expandedDates, setExpandedDates] = createSignal<string[]>([]);

  // Format tampilan bulan: "September 2026"
  const formattedMonthTitle = () => {
    const [year, month] = selectedMonth().split('-').map(Number);
    const dateObj = new Date(year, month - 1, 1);
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const toggleExpandDate = (dateKey: string) => {
    setExpandedDates((prev) =>
      prev.includes(dateKey) ? prev.filter((d) => d !== dateKey) : [...prev, dateKey]
    );
  };

  const filteredDailyGroups = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const groups = groupedExpenses();
    if (!q) return groups;

    return groups
      .map((g) => {
        const dateMatch =
          g.date.toLowerCase().includes(q) || g.formattedDate.toLowerCase().includes(q);
        const matchingItems = g.items.filter(
          (item) =>
            item.category.toLowerCase().includes(q) ||
            (item.note && item.note.toLowerCase().includes(q)) ||
            String(item.amount).includes(q)
        );

        if (dateMatch) {
          return g;
        } else if (matchingItems.length > 0) {
          return {
            ...g,
            items: matchingItems,
            totalDay: matchingItems.reduce((sum, it) => sum + it.amount, 0),
          };
        }
        return null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  });

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
                      <CategoryIcon
                        name={getCategoryConfig(item.category).icon}
                        class="w-3.5 h-3.5 shrink-0"
                        style={{ color: item.color }}
                      />
                      <span>{item.category}</span>
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

      {/* RIWAYAT TRANSAKSI HARIAN (SUM PER HARI) */}
      <div class="mt-2">
        <div class="flex items-center justify-between px-1 mb-2">
          <h3 class="text-xs font-bold text-warm-mute uppercase tracking-wider">
            Riwayat Harian (Total per Hari)
          </h3>
          <span class="text-xs text-warm-mute font-medium">
            {filteredDailyGroups().length} hari
          </span>
        </div>

        {/* Input Pencarian Transaksi */}
        <div class="relative mb-3">
          <Search class="w-4 h-4 text-warm-mute absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari tanggal, kategori, atau catatan..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full bg-warm-card border border-warm-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-warm-ink placeholder:text-warm-faint focus:outline-none focus:border-warm-primary transition-colors"
          />
        </div>

        <Show when={isLoadingExpenses()}>
          <div class="py-8 text-center text-warm-mute text-sm">
            Memuat riwayat pengeluaran...
          </div>
        </Show>

        <Show when={!isLoadingExpenses() && filteredDailyGroups().length === 0}>
          <div class="flex flex-col items-center justify-center py-8 px-4 text-center bg-warm-card/60 border border-dashed border-warm-border rounded-2xl">
            <div class="p-3 rounded-full bg-warm-subtle text-warm-mute mb-2">
              <Inbox class="w-5 h-5" />
            </div>
            <p class="text-xs font-medium text-warm-ink">
              {searchQuery() ? 'Tidak ada transaksi yang cocok' : 'Belum ada pengeluaran di bulan ini'}
            </p>
          </div>
        </Show>

        <div class="space-y-2.5">
          <For each={filteredDailyGroups()}>
            {(group) => {
              const isExpanded = () => expandedDates().includes(group.date);
              return (
                <div class="bg-warm-card border border-warm-border rounded-2xl overflow-hidden transition-all shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
                  {/* Kartu Ringkasan Harian (Sum) */}
                  <button
                    type="button"
                    onClick={() => toggleExpandDate(group.date)}
                    class="w-full p-3.5 flex items-center justify-between text-left hover:bg-warm-subtle/30 transition-colors active:scale-[0.99]"
                  >
                    <div class="flex items-center gap-2.5">
                      <div class="p-2 rounded-xl bg-warm-subtle text-warm-ink shrink-0">
                        <Calendar class="w-4 h-4 text-warm-mute" />
                      </div>
                      <div>
                        <div class="text-xs font-bold text-warm-ink">
                          {group.formattedDate}
                        </div>
                        <div class="text-[11px] text-warm-mute">
                          {group.items.length} transaksi
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-sm font-extrabold text-warm-ink tabular-nums">
                        {formatRupiah(group.totalDay)}
                      </span>
                      <div class="text-warm-mute p-0.5">
                        {isExpanded() ? (
                          <ChevronUp class="w-4 h-4" />
                        ) : (
                          <ChevronDown class="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Detail Item Transaksi jika dibuka */}
                  <Show when={isExpanded()}>
                    <div class="px-3 pb-3 pt-1 border-t border-warm-border/60 bg-warm-card/60">
                      <For each={group.items}>
                        {(expense) => <ExpenseItem expense={expense} />}
                      </For>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
};

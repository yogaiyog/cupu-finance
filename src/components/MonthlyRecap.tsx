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
import { ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-solid';

export const MonthlyRecap: Component = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [expandedDates, setExpandedDates] = createSignal<string[]>([]);

  // Format bulan: "September 2026"
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
      {/* SELECTOR BULAN MINIMALIS */}
      <div class="flex items-center justify-between px-1 mb-3">
        <button
          onClick={() => changeMonth(-1)}
          class="p-1.5 text-warm-mute hover:text-warm-ink hover:bg-warm-subtle/70 rounded-full transition-all active:scale-95"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>

        <h2 class="text-sm font-bold text-warm-ink capitalize tracking-tight">
          {formattedMonthTitle()}
        </h2>

        <button
          onClick={() => changeMonth(1)}
          class="p-1.5 text-warm-mute hover:text-warm-ink hover:bg-warm-subtle/70 rounded-full transition-all active:scale-95"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      {/* KARTU TOTAL */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-4 mb-4 text-center shadow-[0_1px_3px_rgba(45,40,37,0.02)]">
        <div class="text-2xl font-extrabold text-warm-ink tracking-tight tabular-nums">
          {formatRupiah(totalMonthlyExpense())}
        </div>

        <div class="mt-2.5 pt-2.5 border-t border-warm-border/50 flex items-center justify-around text-xs">
          <div>
            <span class="text-[10px] text-warm-faint block uppercase font-medium">Rata-rata</span>
            <span class="font-semibold text-warm-mute tabular-nums">
              {formatRupiah(dailyAverageExpense())}
            </span>
          </div>

          <Show when={settings().dailyBudget}>
            <div class="w-px h-5 bg-warm-border/50" />
            <div>
              <span class="text-[10px] text-warm-faint block uppercase font-medium">Batas Harian</span>
              <span class="font-semibold text-warm-primary tabular-nums">
                {formatRupiah(settings().dailyBudget!)}
              </span>
            </div>
          </Show>
        </div>
      </div>

      {/* KATEGORI BREAKDOWN (BAR SEGMENTED & CHIPS) */}
      <Show when={totalMonthlyExpense() > 0}>
        <div class="bg-warm-card border border-warm-border rounded-2xl p-4 mb-4 shadow-[0_1px_3px_rgba(45,40,37,0.02)]">
          {/* Segmented bar */}
          <div class="w-full h-2 bg-warm-subtle rounded-full overflow-hidden flex mb-3">
            <For each={categoryBreakdown().filter((c) => c.total > 0)}>
              {(item) => (
                <div
                  style={{
                    width: `${item.percentage}%`,
                    'background-color': item.color,
                  }}
                  class="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                  title={`${item.category}: ${item.percentage}%`}
                />
              )}
            </For>
          </div>

          {/* Chips Ringkas */}
          <div class="flex flex-wrap gap-1.5">
            <For each={categoryBreakdown().filter((c) => c.total > 0)}>
              {(item) => (
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warm-subtle/50 text-xs">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    style={{ 'background-color': item.color }}
                  />
                  <span class="font-medium text-warm-ink">{item.category}</span>
                  <span class="text-warm-mute tabular-nums font-semibold">
                    {item.percentage}%
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* RIWAYAT HARIAN */}
      <div class="mt-2">
        <div class="flex items-center justify-between px-1 mb-2">
          <span class="text-xs font-bold text-warm-mute uppercase tracking-wider">
            Riwayat
          </span>

          {/* Search Box Ringkas */}
          <div class="relative flex items-center">
            <Search class="w-3.5 h-3.5 text-warm-mute absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-24 focus:w-36 transition-all bg-warm-card border border-warm-border rounded-full pl-7 pr-5 py-1 text-xs text-warm-ink placeholder:text-warm-faint focus:outline-none focus:border-warm-primary"
            />
            <Show when={searchQuery()}>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                class="absolute right-2 text-warm-mute hover:text-warm-ink text-xs font-bold leading-none"
              >
                ×
              </button>
            </Show>
          </div>
        </div>

        <Show when={isLoadingExpenses()}>
          <div class="py-6 text-center text-warm-mute text-xs">
            Memuat...
          </div>
        </Show>

        <Show when={!isLoadingExpenses() && filteredDailyGroups().length === 0}>
          <div class="py-8 text-center text-xs text-warm-mute">
            {searchQuery() ? 'Tidak ada yang cocok' : 'Belum ada transaksi'}
          </div>
        </Show>

        <div class="space-y-1.5">
          <For each={filteredDailyGroups()}>
            {(group) => {
              const isExpanded = () => expandedDates().includes(group.date);
              return (
                <div class="bg-warm-card border border-warm-border rounded-xl overflow-hidden transition-all shadow-[0_1px_2px_rgba(45,40,37,0.02)]">
                  {/* Baris Ringkasan Harian */}
                  <button
                    type="button"
                    onClick={() => toggleExpandDate(group.date)}
                    class="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-warm-subtle/30 transition-colors active:scale-[0.99]"
                  >
                    <div class="flex items-baseline gap-2">
                      <span class="text-xs font-bold text-warm-ink">
                        {group.formattedDate}
                      </span>
                      <span class="text-[11px] text-warm-faint">
                        ({group.items.length})
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-warm-ink tabular-nums">
                        {formatRupiah(group.totalDay)}
                      </span>
                      <ChevronDown
                        class={`w-3.5 h-3.5 text-warm-faint transition-transform duration-200 ${
                          isExpanded() ? 'rotate-180 text-warm-ink' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Detail Item Transaksi jika dibuka */}
                  <Show when={isExpanded()}>
                    <div class="px-2.5 pb-2.5 pt-1 border-t border-warm-border/50 bg-warm-subtle/20 space-y-1">
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

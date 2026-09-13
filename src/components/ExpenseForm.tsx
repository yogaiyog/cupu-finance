import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { Category, ExpenseCategory } from '../types';
import { addExpense } from '../stores/expenseStore';
import { categories } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import { AddCategoryModal } from './AddCategoryModal';
import { Check, MessageSquare, Plus, ChevronLeft, ChevronRight } from 'lucide-solid';

type CategoryPickerItem =
  | { type: 'category'; data: Category }
  | { type: 'add' };

export const ExpenseForm: Component = () => {
  const [rawAmount, setRawAmount] = createSignal<string>('');
  const [selectedCategory, setSelectedCategory] = createSignal<ExpenseCategory>('Makanan');
  const [note, setNote] = createSignal<string>('');
  const [isSuccess, setIsSuccess] = createSignal<boolean>(false);
  const [showAddModal, setShowAddModal] = createSignal<boolean>(false);
  let categorySliderRef: HTMLDivElement | undefined;

  const allCategoryItems = createMemo<CategoryPickerItem[]>(() => {
    const list: CategoryPickerItem[] = categories().map((c) => ({ type: 'category', data: c }));
    list.push({ type: 'add' });
    return list;
  });

  // Arrow < > hanya muncul jika item kategori lebih dari 9
  const showArrows = createMemo(() => allCategoryItems().length > 9);

  // Pagination flex max 3 row (~9 items per view/page)
  const categoryPages = createMemo(() => {
    const items = allCategoryItems();
    if (items.length <= 9) {
      return [items];
    }
    const chunks: CategoryPickerItem[][] = [];
    for (let i = 0; i < items.length; i += 9) {
      chunks.push(items.slice(i, i + 9));
    }
    return chunks;
  });

  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categorySliderRef) return;
    const scrollAmount = categorySliderRef.clientWidth;
    categorySliderRef.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Format input angka menjadi ribuan dengan prefix Rp
  const handleAmountInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    const digitsOnly = target.value.replace(/\D/g, '');
    setRawAmount(digitsOnly);
  };

  const formattedDisplay = () => {
    if (!rawAmount()) return '';
    return Number(rawAmount()).toLocaleString('id-ID');
  };

  // Shortcut penambahan nominal cepat
  const addQuickAmount = (val: number) => {
    const current = Number(rawAmount()) || 0;
    setRawAmount(String(current + val));
  };

  const handleClear = () => {
    setRawAmount('');
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const amountNum = Number(rawAmount());
    if (!amountNum || amountNum <= 0) {
      alert('Masukkan nominal pengeluaran yang valid.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    await addExpense({
      amount: amountNum,
      category: selectedCategory(),
      note: note(),
      date: todayStr,
    });

    // Reset form
    setRawAmount('');
    setNote('');
    setIsSuccess(true);
    setTimeout(() => setIsSuccess(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit} class="w-full bg-warm-card border border-warm-border rounded-2xl p-5 shadow-[0_2px_8px_rgba(45,40,37,0.03)] mb-6">
      {/* AREA INPUT NOMINAL BESAR */}
      <div class="flex flex-col items-center justify-center py-2">
        <label class="text-xs font-semibold text-warm-mute mb-1">Nominal Pengeluaran</label>
        <div class="relative w-full flex items-center justify-center">
          <span class="text-2xl font-bold text-warm-mute mr-1 select-none">Rp</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={formattedDisplay()}
            onInput={handleAmountInput}
            class="text-3xl sm:text-4xl font-bold text-warm-ink bg-transparent text-center focus:outline-none w-56 tracking-tight tabular-nums placeholder:text-warm-faint"
            autofocus
          />
          {rawAmount() && (
            <button
              type="button"
              onClick={handleClear}
              class="absolute right-2 text-xs font-medium text-warm-mute hover:text-warm-ink px-2 py-1 bg-warm-subtle rounded-md"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Quick Amount Chips */}
        <div class="flex items-center gap-1.5 mt-3">
          <button
            type="button"
            onClick={() => addQuickAmount(10000)}
            class="px-2.5 py-1 text-xs rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors font-medium active:scale-95"
          >
            +10rb
          </button>
          <button
            type="button"
            onClick={() => addQuickAmount(20000)}
            class="px-2.5 py-1 text-xs rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors font-medium active:scale-95"
          >
            +20rb
          </button>
          <button
            type="button"
            onClick={() => addQuickAmount(50000)}
            class="px-2.5 py-1 text-xs rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors font-medium active:scale-95"
          >
            +50rb
          </button>
          <button
            type="button"
            onClick={() => addQuickAmount(100000)}
            class="px-2.5 py-1 text-xs rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors font-medium active:scale-95"
          >
            +100rb
          </button>
        </div>
      </div>

      {/* PILIHAN KATEGORI (FLEX WRAP, MAX 3 ROW, ARROW JIKA > 9 ITEM) */}
      <div class="mt-4">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-semibold text-warm-mute">Pilih Kategori</label>
          <Show when={showArrows()}>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollCategories('left')}
                class="p-1 rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors active:scale-95"
                aria-label="Kategori Sebelumnya"
              >
                <ChevronLeft class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollCategories('right')}
                class="p-1 rounded-full bg-warm-subtle text-warm-ink hover:bg-warm-primary/30 transition-colors active:scale-95"
                aria-label="Kategori Selanjutnya"
              >
                <ChevronRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </Show>
        </div>

        <div
          ref={categorySliderRef}
          class="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth w-full"
        >
          <For each={categoryPages()}>
            {(pageItems) => (
              <div class="w-full shrink-0 snap-start flex flex-wrap justify-center items-center content-center gap-2 min-h-[114px] py-1">
                <For each={pageItems}>
                  {(item) => {
                    if (item.type === 'category') {
                      const cat = item.data;
                      const isSelected = () => selectedCategory() === cat.name;
                      return (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(cat.name)}
                          class={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border shrink-0 active:scale-95 ${
                            isSelected()
                              ? 'bg-warm-primary text-white border-warm-primary shadow-sm scale-100 ring-2 ring-warm-primary/30'
                              : 'bg-warm-subtle text-warm-ink border-warm-border hover:border-warm-primary/50'
                          }`}
                          style={{ 'min-width': '96px' }}
                        >
                          <span style={{ color: isSelected() ? '#ffffff' : cat.color }}>
                            <CategoryIcon name={cat.icon} class="w-3.5 h-3.5 shrink-0" />
                          </span>
                          <span class="max-w-[100px] truncate">{cat.name}</span>
                        </button>
                      );
                    }

                    // Tombol Tambah Kategori
                    return (
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border border-dashed border-warm-primary text-warm-primary bg-warm-card hover:bg-warm-subtle/50 shrink-0 active:scale-95"
                        style={{ 'min-width': '96px' }}
                      >
                        <Plus class="w-3.5 h-3.5 shrink-0" />
                        <span>Tambah</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* CATATAN OPSIONAL */}
      <div class="mt-4">
        <div class="flex items-center gap-2 px-3.5 py-2.5 bg-warm-subtle/60 border border-warm-border rounded-xl">
          <MessageSquare class="w-4 h-4 text-warm-mute shrink-0" />
          <input
            type="text"
            placeholder="Catatan (opsional)"
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
            class="w-full bg-transparent text-xs text-warm-ink font-medium placeholder:text-warm-faint focus:outline-none"
          />
        </div>
      </div>

      {/* TOMBOL SIMPAN UTAMA */}
      <div class="mt-5">
        <button
          type="submit"
          class={`w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            isSuccess()
              ? 'bg-sync-synced text-white shadow-sm'
              : 'bg-warm-primary text-white hover:bg-warm-primary-dark shadow-[0_2px_8px_rgba(213,189,175,0.4)]'
          }`}
        >
          {isSuccess() ? (
            <>
              <Check class="w-5 h-5" />
              <span>Tersimpan!</span>
            </>
          ) : (
            <span>Simpan Pengeluaran</span>
          )}
        </button>
      </div>

      <AddCategoryModal
        isOpen={showAddModal()}
        onClose={() => setShowAddModal(false)}
        onCreated={(newCat) => setSelectedCategory(newCat.name)}
      />
    </form>
  );
};

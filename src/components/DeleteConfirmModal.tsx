import { Component, Show, createEffect, onCleanup } from 'solid-js';
import {
  expenseToDelete,
  cancelDeleteExpense,
  confirmDeleteExpense,
  formatRupiah,
} from '../stores/expenseStore';
import { getCategoryConfig } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import {
  Trash2,
  X,
  Calendar,
} from 'lucide-solid';

export const DeleteConfirmModal: Component = () => {
  // Tutup dengan tombol Escape
  createEffect(() => {
    if (!expenseToDelete()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDeleteExpense();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  return (
    <Show when={expenseToDelete()}>
      {(expense) => {
        const config = () => getCategoryConfig(expense().category);

        return (
          <div
            class="fixed inset-0 z-[100] bg-warm-ink/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelDeleteExpense();
              }
            }}
          >
            <div class="bg-warm-card border border-warm-border rounded-2xl p-5 max-w-xs w-full shadow-2xl animate-scaleUp relative">
              {/* Tombol Silang Pojok Kanan */}
              <button
                type="button"
                onClick={cancelDeleteExpense}
                class="absolute top-3.5 right-3.5 p-1 rounded-lg text-warm-mute hover:text-warm-ink hover:bg-warm-subtle transition-colors"
                title="Tutup"
              >
                <X class="w-4 h-4" />
              </button>

              {/* Ikon Tong Sampah Merah Lembut */}
              <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                <Trash2 class="w-6 h-6" />
              </div>

              {/* Judul & Penjelasan */}
              <div class="text-center mb-4">
                <h3 class="text-base font-bold text-warm-ink mb-1">
                  Hapus Catatan?
                </h3>
                <p class="text-xs text-warm-mute leading-relaxed">
                  Catatan ini akan dihapus dari riwayat pengeluaran Anda.
                </p>
              </div>

              {/* Ringkasan Catatan yang Akan Dihapus */}
              <div class="p-3 bg-warm-subtle/70 border border-warm-border rounded-xl mb-4 text-left">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ 'background-color': config().softColor }}
                    >
                      <CategoryIcon
                        name={config().icon}
                        class="w-4 h-4"
                        style={{ color: config().color }}
                      />
                    </div>
                    <span class="text-xs font-bold text-warm-ink">
                      {expense().category}
                    </span>
                  </div>
                  <span class="text-xs font-bold text-warm-ink tabular-nums">
                    {formatRupiah(expense().amount)}
                  </span>
                </div>

                <div class="flex items-center justify-between text-[11px] text-warm-mute pt-1 border-t border-warm-border/50">
                  <span class="truncate max-w-[150px]">
                    {expense().note || 'Tanpa catatan'}
                  </span>
                  <span class="shrink-0 flex items-center gap-1">
                    <Calendar class="w-3 h-3 text-warm-primary" />
                    <span>{expense().date}</span>
                  </span>
                </div>
              </div>

              {/* Tombol Aksi: Batal & Ya, Hapus */}
              <div class="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={cancelDeleteExpense}
                  class="flex-1 py-2.5 px-3 rounded-xl border border-warm-border bg-warm-card text-warm-ink hover:bg-warm-subtle text-xs font-bold transition-all active:scale-[0.98]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteExpense}
                  class="flex-1 py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-[0_2px_8px_rgba(239,68,68,0.25)] active:scale-[0.98]"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
};

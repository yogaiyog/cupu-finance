import { Component, createSignal, For, Show } from 'solid-js';
import {
  PRESET_COLORS,
  PRESET_ICONS,
  addCategory,
  ColorPreset,
} from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import { Category } from '../types';
import { X, Check } from 'lucide-solid';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (category: Category) => void;
}

export const AddCategoryModal: Component<AddCategoryModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [selectedColor, setSelectedColor] = createSignal<ColorPreset>(PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = createSignal<string>(PRESET_ICONS[0]);
  const [errorMessage, setErrorMessage] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const resetForm = () => {
    setName('');
    setSelectedColor(PRESET_COLORS[0]);
    setSelectedIcon(PRESET_ICONS[0]);
    setErrorMessage('');
  };

  const handleClose = () => {
    resetForm();
    props.onClose();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name().trim()) {
      setErrorMessage('Nama kategori wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const created = await addCategory({
        name: name().trim(),
        color: selectedColor().color,
        softColor: selectedColor().softColor,
        icon: selectedIcon(),
      });
      props.onCreated?.(created);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kategori');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
        <div class="w-full max-w-sm bg-warm-card border border-warm-border rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="flex items-center justify-between pb-3 border-b border-warm-border/60">
            <h3 class="text-base font-bold text-warm-ink">Tambah Kategori Baru</h3>
            <button
              type="button"
              onClick={handleClose}
              class="p-1 rounded-full text-warm-mute hover:text-warm-ink hover:bg-warm-subtle transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} class="mt-4 space-y-4">
            {/* Live Preview */}
            <div class="flex flex-col items-center justify-center py-2 bg-warm-canvas/60 rounded-xl border border-warm-border/60">
              <span class="text-[11px] font-semibold text-warm-mute mb-2">Preview Tampilan</span>
              <div
                class="flex items-center gap-2 px-4 py-2 rounded-full border shadow-xs"
                style={{
                  'background-color': selectedColor().softColor,
                  'border-color': selectedColor().color + '40',
                }}
              >
                <CategoryIcon
                  name={selectedIcon()}
                  class="w-4 h-4"
                  style={{ color: selectedColor().color }}
                />
                <span class="text-xs font-bold text-warm-ink">
                  {name().trim() || 'Nama Kategori'}
                </span>
              </div>
            </div>

            {/* Input Nama */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1">
                Nama Kategori
              </label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Contoh: Kopi, Skincare, Sedekah"
                maxlength={24}
                class="w-full px-3 py-2 text-sm bg-warm-canvas border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary font-medium"
                autofocus
              />
            </div>

            {/* Pilih Ikon */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1.5">
                Pilih Ikon
              </label>
              <div class="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1.5 bg-warm-canvas/50 rounded-xl border border-warm-border/50">
                <For each={PRESET_ICONS}>
                  {(icon) => {
                    const isSelected = () => selectedIcon() === icon;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedIcon(icon)}
                        class={`p-2 rounded-xl flex items-center justify-center transition-all ${
                          isSelected()
                            ? 'bg-warm-primary text-white shadow-xs scale-105'
                            : 'text-warm-mute hover:text-warm-ink hover:bg-warm-subtle'
                        }`}
                      >
                        <CategoryIcon name={icon} class="w-4 h-4" />
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Pilih Warna */}
            <div>
              <label class="text-xs font-semibold text-warm-mute block mb-1.5">
                Pilih Warna Tema
              </label>
              <div class="grid grid-cols-5 gap-2 p-1.5 bg-warm-canvas/50 rounded-xl border border-warm-border/50">
                <For each={PRESET_COLORS}>
                  {(cp) => {
                    const isSelected = () => selectedColor().color === cp.color;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedColor(cp)}
                        class="h-8 rounded-lg flex items-center justify-center transition-transform relative"
                        style={{ 'background-color': cp.color }}
                        title={cp.label}
                      >
                        <Show when={isSelected()}>
                          <Check class="w-4 h-4 text-white" />
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Error Message */}
            <Show when={errorMessage()}>
              <p class="text-xs text-cat-bills font-medium">{errorMessage()}</p>
            </Show>

            {/* Action Buttons */}
            <div class="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                class="flex-1 py-2 text-xs font-semibold text-warm-mute bg-warm-subtle rounded-xl hover:text-warm-ink transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting()}
                class="flex-1 py-2 text-xs font-semibold text-white bg-warm-primary hover:bg-warm-primary-dark rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting() ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};

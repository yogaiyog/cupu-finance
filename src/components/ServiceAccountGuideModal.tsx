import { Component, Show } from 'solid-js';
import { X, ExternalLink, HelpCircle } from 'lucide-solid';

interface ServiceAccountGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceAccountGuideModal: Component<ServiceAccountGuideModalProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-warm-card border border-warm-border rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[85vh] flex flex-col">
          {/* HEADER */}
          <div class="flex items-center justify-between pb-3 border-b border-warm-border shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-warm-subtle text-warm-primary flex items-center justify-center">
                <HelpCircle class="w-4 h-4" />
              </div>
              <div>
                <h3 class="text-xs font-bold text-warm-ink">Panduan Kunci JSON Google</h3>
                <p class="text-[10px] text-warm-mute">Cara membuat Service Account resmi (Gratis)</p>
              </div>
            </div>
            <button
              onClick={props.onClose}
              class="p-1 text-warm-mute hover:text-warm-ink rounded-lg"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          {/* CONTENT LANGKAH-LANGKAH (SCROLLABLE) */}
          <div class="overflow-y-auto py-3.5 space-y-3 flex-1 text-[11px] text-warm-ink pr-1">
            {/* Direct Link to Google Cloud */}
            <div class="p-3 rounded-xl bg-warm-subtle border border-warm-border flex items-center justify-between">
              <div>
                <span class="font-bold block text-warm-ink text-xs">Google Cloud Console</span>
                <span class="text-[10px] text-warm-mute">Buka dashboard konsol resmi Google Cloud</span>
              </div>
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noreferrer"
                class="px-2.5 py-1.5 bg-warm-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-1 hover:bg-warm-primary-dark transition-colors shrink-0"
              >
                <span>Buka Web</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>

            {/* Langkah 1 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                1
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Buat Project Baru</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Masuk dengan akun Google Anda, klik pemilih project di bilah atas, lalu pilih <strong>New Project</strong> (beri nama misalnya: <em>Cupu Finance</em>).
                </p>
              </div>
            </div>

            {/* Langkah 2 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                2
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Aktifkan Google Sheets API</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Buka menu <strong>APIs & Services</strong> &gt; <strong>Library</strong>. Cari <code>Google Sheets API</code>, lalu klik tombol <strong>Enable (Aktifkan)</strong>.
                </p>
              </div>
            </div>

            {/* Langkah 3 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                3
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Buat Service Account</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Buka menu <strong>APIs & Services</strong> &gt; <strong>Credentials</strong>. Klik <strong>Create Credentials</strong> di bagian atas lalu pilih <strong>Service Account</strong>. Beri nama (misalnya: <em>sheet-bot</em>) dan klik <strong>Create and Continue</strong> sampai selesai.
                </p>
              </div>
            </div>

            {/* Langkah 4 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                4
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Unduh Kunci (Key) JSON</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Di daftar Service Accounts, klik email robot yang baru dibuat. Pilih tab <strong>Keys</strong> &gt; klik <strong>Add Key</strong> &gt; <strong>Create new key</strong> &gt; pilih format <strong>JSON</strong> &gt; <strong>Create</strong>. File <code>.json</code> akan terunduh otomatis ke perangkat Anda.
                </p>
              </div>
            </div>

            {/* Langkah 5 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                5
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Copas Teks JSON ke Cupu Finance</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Buka file <code>.json</code> tersebut menggunakan TextEdit/Notepad, salin (copy) seluruh teks di dalamnya, lalu paste ke kolom input di Cupu Finance.
                </p>
              </div>
            </div>

            {/* Langkah 6 */}
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-warm-subtle text-warm-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 border border-warm-border">
                6
              </div>
              <div>
                <strong class="text-warm-ink block font-semibold">Bagikan Google Sheet Anda</strong>
                <p class="text-warm-mute leading-relaxed text-[10.5px]">
                  Buka file Google Sheet Anda di Google Drive, klik <strong>Bagikan (Share)</strong>, lalu tambahkan alamat <code>client_email</code> dari JSON tersebut dengan izin <strong>Editor</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div class="pt-3 border-t border-warm-border flex justify-end shrink-0">
            <button
              onClick={props.onClose}
              class="px-4 py-2 bg-warm-primary text-white text-xs font-bold rounded-xl hover:bg-warm-primary-dark transition-colors"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

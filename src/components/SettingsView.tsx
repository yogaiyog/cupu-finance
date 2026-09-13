import { Component, createSignal, Show } from 'solid-js';
import {
  settings,
  updateSettings,
  setSyncMode,
  setScriptUrl,
  setServiceAccountConfig,
  setSpreadsheetId,
  setUserName,
  setMonthlyIncome,
  setDailyBudget,
} from '../stores/settingsStore';
import { triggerSync, syncStatus } from '../services/sync/syncManager';
import { appsScriptSyncProvider } from '../services/sync/appsScriptSync';
import { serviceAccountSyncProvider } from '../services/sync/serviceAccountSync';
import { db } from '../services/db';
import { loadExpensesForSelectedMonth } from '../stores/expenseStore';
import { ServiceAccountGuideModal } from './ServiceAccountGuideModal';
import {
  RefreshCw,
  Cloud,
  Link2,
  HardDrive,
  Trash2,
  KeyRound,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  HelpCircle,
  Calculator,
  ChevronDown,
  X,
} from 'lucide-solid';

export const SettingsView: Component = () => {
  const [isSyncOpen, setIsSyncOpen] = createSignal(false);
  const [testStatus, setTestStatus] = createSignal<{ success?: boolean; message?: string }>({});
  const [isTesting, setIsTesting] = createSignal(false);
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [csvExportStatus, setCsvExportStatus] = createSignal<{ success?: boolean; message?: string }>({});
  const [showClearModal, setShowClearModal] = createSignal(false);
  const [clearConfirmText, setClearConfirmText] = createSignal('');
  const [isClearing, setIsClearing] = createSignal(false);

  // State untuk Profil & Budget Harian
  const [userNameInput, setUserNameInput] = createSignal(settings().userName || '');
  const [userIncomeInput, setUserIncomeInput] = createSignal(
    settings().monthlyIncome ? new Intl.NumberFormat('id-ID').format(settings().monthlyIncome!) : ''
  );
  const [budgetSaveMessage, setBudgetSaveMessage] = createSignal('');

  // State untuk Service Account JSON
  const [saJsonInput, setSaJsonInput] = createSignal(settings().serviceAccountJson || '');
  const [sheetIdInput, setSheetIdInput] = createSignal(settings().spreadsheetId || '');
  const [saTestStatus, setSaTestStatus] = createSignal<{ success?: boolean; message?: string }>({});
  const [isSaTesting, setIsSaTesting] = createSignal(false);
  const [copiedEmail, setCopiedEmail] = createSignal(false);
  const [showGuideModal, setShowGuideModal] = createSignal(false);

  // Email robot dari input atau settings
  const currentBotEmail = () => {
    try {
      if (saJsonInput().trim()) {
        const parsed = JSON.parse(saJsonInput().trim());
        return parsed.client_email || '';
      }
    } catch {
      // ignore
    }
    return settings().serviceAccountEmail || '';
  };

  // Tes Koneksi Service Account
  const handleTestServiceAccount = async () => {
    setIsSaTesting(true);
    setSaTestStatus({});

    // Simpan dulu ke store
    const saveRes = await setServiceAccountConfig(saJsonInput(), sheetIdInput());
    if (!saveRes.success) {
      setSaTestStatus({ success: false, message: saveRes.error });
      setIsSaTesting(false);
      return;
    }

    if (sheetIdInput().trim()) {
      await setSpreadsheetId(sheetIdInput().trim());
    }

    const testRes = await serviceAccountSyncProvider.testConnection(
      saJsonInput().trim(),
      sheetIdInput().trim()
    );
    setSaTestStatus(testRes);
    setIsSaTesting(false);
  };

  // Salin email bot ke clipboard
  const handleCopyEmail = async () => {
    const email = currentBotEmail();
    if (email) {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  // Tes Koneksi Webhook Apps Script
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus({});
    const res = await appsScriptSyncProvider.testConnection();
    setTestStatus(res);
    setIsTesting(false);
  };

  // Trigger Force Sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    const res = await triggerSync(true);
    await loadExpensesForSelectedMonth();
    setIsSyncing(false);
    if (!res.success && res.message) {
      alert(res.message);
    }
  };

  // Export Data ke Format Sheet (CSV) murni tanpa library
  const handleExportCsv = async () => {
    try {
      const csvString = await db.exportToCsv();
      // Prefix \uFEFF (UTF-8 BOM) agar Excel / Google Sheets otomatis membaca karakter Unicode dengan benar
      const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `cupu-finance-transaksi-${today}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCsvExportStatus({ success: true, message: 'File CSV berhasil diunduh!' });
      setTimeout(() => setCsvExportStatus({}), 3500);
    } catch (err: any) {
      setCsvExportStatus({ success: false, message: 'Gagal ekspor: ' + err.message });
      setTimeout(() => setCsvExportStatus({}), 3500);
    }
  };

  // Buka Modal Konfirmasi Hapus Semua Data
  const handleOpenClearModal = () => {
    setClearConfirmText('');
    setShowClearModal(true);
  };

  return (
    <div class="w-full pb-16">
      <h2 class="text-lg font-bold text-warm-ink mb-1">Pengaturan & Sinkronisasi</h2>
      <p class="text-xs text-warm-mute mb-5">
        Atur penyimpanan cloud Google Sheet dan cadangan data lokal Anda.
      </p>

      {/* METODE SINKRONISASI (COLLAPSIBLE) */}
      <div class="bg-warm-card border border-warm-border rounded-2xl mb-5 shadow-[0_1px_3px_rgba(45,40,37,0.03)] overflow-hidden transition-all">
        {/* Accordion Toggle Header */}
        <button
          type="button"
          onClick={() => setIsSyncOpen(!isSyncOpen())}
          class="w-full p-4 flex items-center justify-between text-left hover:bg-warm-subtle/50 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-xl bg-warm-subtle border border-warm-border flex items-center justify-center shrink-0">
              <Cloud class="w-4 h-4 text-warm-primary" />
            </div>
            <div>
              <h3 class="text-xs font-bold text-warm-ink leading-tight">
                Pilihan Sinkronisasi Cloud
              </h3>
              <p class="text-[11px] text-warm-mute mt-0.5">
                {settings().syncMode === 'service_account'
                  ? (settings().serviceAccountJson && settings().spreadsheetId ? 'Google Service Account (Aktif)' : 'Google Service Account (Offline)')
                  : (settings().scriptUrl ? 'Custom Webhook (Aktif)' : 'Custom Webhook (Offline)')}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              syncStatus() === 'synced'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {syncStatus() === 'synced' ? 'Online' : 'Offline'}
            </span>
            <ChevronDown
              class={`w-4 h-4 text-warm-mute transition-transform duration-200 ${
                isSyncOpen() ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {/* Collapsed Body */}
        <Show when={isSyncOpen()}>
          <div class="p-4 pt-1 border-t border-warm-border/60">
            <p class="text-[11px] text-warm-mute my-3">
              Pilih salah satu metode di bawah. Jika kolom input belum diisi, aplikasi otomatis berjalan dalam mode offline lokal.
            </p>

            <div class="space-y-2.5">
          {/* Opsi 1: Google Service Account (Kunci JSON) */}
          <label class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            settings().syncMode === 'service_account'
              ? 'bg-warm-subtle/70 border-warm-primary'
              : 'border-warm-border hover:bg-warm-subtle/30'
          }`}>
            <input
              type="radio"
              name="syncMode"
              checked={settings().syncMode === 'service_account'}
              onChange={() => setSyncMode('service_account')}
              class="mt-1 accent-warm-primary"
            />
            <div class="flex-1">
              <span class="text-xs font-bold text-warm-ink block">
                Google Service Account (Kunci JSON)
              </span>
              <span class="text-[11px] text-warm-mute block mt-0.5">
                Rekomendasi terbaik: tanpa popup login, tidak pernah logout, langsung sinkron otomatis ke Google Sheet.
              </span>

              <Show when={settings().syncMode === 'service_account'}>
                <div class="mt-3 pt-3 border-t border-warm-border space-y-3">
                  {/* Kolom Input JSON */}
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-[11px] font-semibold text-warm-mute flex items-center gap-1.5">
                        <KeyRound class="w-3.5 h-3.5 text-warm-primary" />
                        <span>Copas Isi Kunci JSON Service Account</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        class="text-[10.5px] text-warm-primary hover:underline font-bold flex items-center gap-1"
                      >
                        <HelpCircle class="w-3 h-3" />
                        <span>Cara Mendapatkannya</span>
                      </button>
                    </div>
                    <textarea
                      placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
                      value={saJsonInput()}
                      onInput={(e) => setSaJsonInput(e.currentTarget.value)}
                      rows={4}
                      class="w-full text-[11px] p-2.5 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-mono placeholder:text-warm-faint resize-y"
                    ></textarea>
                  </div>

                  {/* Email bot penerima share spreadsheet */}
                  <Show when={currentBotEmail()}>
                    <div class="p-2.5 bg-warm-subtle border border-warm-border rounded-lg text-[11px]">
                      <div class="text-warm-mute mb-1 font-medium">
                        Bagikan (Share) Google Sheet Anda ke email robot ini:
                      </div>
                      <div class="flex items-center justify-between gap-2 bg-warm-card p-2 rounded border border-warm-border">
                        <code class="text-[10px] text-warm-ink font-mono break-all select-all">
                          {currentBotEmail()}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyEmail}
                          class="p-1 text-warm-primary hover:text-warm-primary-dark shrink-0 flex items-center gap-1 text-[10px] font-semibold"
                        >
                          {copiedEmail() ? <Check class="w-3.5 h-3.5 text-cat-health" /> : <Copy class="w-3.5 h-3.5" />}
                          <span>{copiedEmail() ? 'Disalin' : 'Salin'}</span>
                        </button>
                      </div>
                      <p class="text-[10px] text-warm-mute mt-1">
                        Pilih hak akses: <strong>Editor</strong> agar data transaksi bisa ditulis.
                      </p>
                    </div>
                  </Show>

                  {/* Kolom Link / ID Google Sheet */}
                  <div>
                    <label class="text-[11px] font-semibold text-warm-mute block mb-1 flex items-center gap-1.5">
                      <FileSpreadsheet class="w-3.5 h-3.5 text-warm-primary" />
                      <span>Link atau ID Google Sheet Anda</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit atau ID saja"
                      value={sheetIdInput()}
                      onInput={(e) => setSheetIdInput(e.currentTarget.value)}
                      class="w-full text-xs p-2.5 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint font-mono"
                    />
                  </div>

                  {/* Tombol Simpan & Tes Koneksi */}
                  <button
                    type="button"
                    onClick={handleTestServiceAccount}
                    disabled={isSaTesting()}
                    class="w-full px-4 py-2.5 bg-warm-primary text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-warm-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw class={`w-3.5 h-3.5 ${isSaTesting() ? 'animate-spin' : ''}`} />
                    <span>{isSaTesting() ? 'Menguji & Menyiapkan Sheet...' : 'Simpan & Tes Koneksi'}</span>
                  </button>

                  {/* Feedback Hasil Tes */}
                  <Show when={saTestStatus().message}>
                    <div
                      class={`p-2.5 rounded-lg text-xs font-medium flex items-start gap-2 ${
                        saTestStatus().success
                          ? 'bg-cat-health-soft text-cat-health'
                          : 'bg-cat-bills-soft text-cat-bills'
                      }`}
                    >
                      <Show
                        when={saTestStatus().success}
                        fallback={<AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />}
                      >
                        <CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5" />
                      </Show>
                      <span class="flex-1">{saTestStatus().message}</span>
                    </div>
                  </Show>

                  {/* Tautan langsung ke file Sheet jika sudah ada */}
                  <Show when={settings().spreadsheetId}>
                    <div class="pt-1 flex items-center justify-between text-[11px]">
                      <span class="text-warm-mute">Google Sheet Terhubung:</span>
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${settings().spreadsheetId}`}
                        target="_blank"
                        class="text-cat-transport hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Link2 class="w-3 h-3" />
                        <span>Buka di Google Sheets</span>
                      </a>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </label>

          {/* Opsi 2: Apps Script Webhook */}
          <label class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            settings().syncMode === 'apps_script'
              ? 'bg-warm-subtle/70 border-warm-primary'
              : 'border-warm-border hover:bg-warm-subtle/30'
          }`}>
            <input
              type="radio"
              name="syncMode"
              checked={settings().syncMode === 'apps_script'}
              onChange={() => setSyncMode('apps_script')}
              class="mt-1 accent-warm-primary"
            />
            <div class="flex-1">
              <span class="text-xs font-bold text-warm-ink block">
                Custom Webhook (Google Apps Script)
              </span>
              <span class="text-[11px] text-warm-mute block mt-0.5">
                Untuk pengguna tingkat lanjut / tanpa login Google di app: masukkan URL Webhook Apps Script pribadi Anda.
              </span>

              <Show when={settings().syncMode === 'apps_script'}>
                <div class="mt-3 pt-3 border-t border-warm-border">
                  <label class="text-[11px] font-semibold text-warm-mute block mb-1">
                    URL Web App Google Apps Script
                  </label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={settings().scriptUrl || ''}
                    onInput={(e) => setScriptUrl(e.currentTarget.value)}
                    class="w-full text-xs p-2.5 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-mono placeholder:text-warm-faint"
                  />

                  <div class="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting()}
                      class="px-3 py-1.5 bg-warm-subtle text-warm-ink border border-warm-border text-xs font-semibold rounded-lg hover:bg-warm-border transition-colors disabled:opacity-50"
                    >
                      {isTesting() ? 'Menguji...' : 'Tes Koneksi'}
                    </button>
                    <a
                      href="https://github.com"
                      target="_blank"
                      class="text-[11px] text-cat-transport hover:underline flex items-center gap-1"
                    >
                      <Link2 class="w-3 h-3" />
                      Lihat Script Google Sheets
                    </a>
                  </div>

                  <Show when={testStatus().message}>
                    <div
                      class={`mt-2 p-2 rounded text-xs font-medium ${
                        testStatus().success
                          ? 'bg-cat-health-soft text-cat-health'
                          : 'bg-cat-bills-soft text-cat-bills'
                      }`}
                    >
                      {testStatus().message}
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </label>

        </div>
          {/* Tombol Paksa Sync */}
          <div class="mt-4 pt-4 border-t border-warm-border flex items-center justify-between">
            <span class="text-xs text-warm-mute">
              Status saat ini: <strong class="text-warm-ink capitalize">{syncStatus()}</strong>
            </span>
            <button
              onClick={handleForceSync}
              disabled={isSyncing()}
              class="px-3.5 py-1.5 bg-warm-primary text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-warm-primary-dark transition-colors disabled:opacity-50"
            >
              <RefreshCw class={`w-3.5 h-3.5 ${isSyncing() ? 'animate-spin' : ''}`} />
              <span>Sinkronkan Sekarang</span>
            </button>
          </div>
        </div>
      </Show>
    </div>

      {/* PENGATURAN BUDGET & SALDO BERTAHAN HIDUP */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-5 mb-5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <h3 class="text-sm font-bold text-warm-ink mb-1 flex items-center gap-2">
          <Calculator class="w-4 h-4 text-warm-primary" />
          <span>Budget Harian & Saldo Bertahan</span>
        </h3>
        <p class="text-[11px] text-warm-mute mb-4 leading-normal">
          Ubah jatah budget harian yang tampil di dashboard Catat Transaksi.
        </p>

        <div class="space-y-3">
          <div>
            <label class="text-[11px] font-semibold text-warm-mute block mb-1">
              Nama Panggilan
            </label>
            <input
              type="text"
              placeholder="Yoga"
              value={userNameInput()}
              onInput={(e) => setUserNameInput(e.currentTarget.value)}
              class="w-full text-xs p-2.5 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-medium placeholder:text-warm-faint"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-warm-mute block mb-1">
              Gaji / Penghasilan Bulanan
            </label>
            <input
              type="text"
              placeholder="5.000.000"
              value={userIncomeInput()}
              onInput={(e) => {
                const raw = e.currentTarget.value.replace(/\D/g, '');
                setUserIncomeInput(raw ? new Intl.NumberFormat('id-ID').format(Number(raw)) : '');
              }}
              class="w-full text-xs p-2.5 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-bold placeholder:text-warm-faint"
            />
          </div>

          <button
            type="button"
            onClick={async () => {
              if (userNameInput().trim()) {
                await setUserName(userNameInput().trim());
              }
              const inc = Number(userIncomeInput().replace(/\D/g, '')) || 0;
              if (inc > 0) {
                await setMonthlyIncome(inc);
                const now = new Date();
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const newDaily = Math.round(inc / lastDay);
                await setDailyBudget(newDaily);
              }
              setBudgetSaveMessage('Pengaturan profil & budget berhasil disimpan!');
              setTimeout(() => setBudgetSaveMessage(''), 3000);
            }}
            class="w-full mt-1 px-4 py-2 bg-warm-primary text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-warm-primary-dark transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Simpan Pengaturan</span>
          </button>

          <Show when={budgetSaveMessage()}>
            <div class="p-2 bg-cat-health-soft text-cat-health rounded-lg text-[11px] font-semibold text-center">
              {budgetSaveMessage()}
            </div>
          </Show>
        </div>
      </div>

      {/* MANAJEMEN DATA & CADANGAN */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-5 mb-5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <h3 class="text-sm font-bold text-warm-ink mb-3 flex items-center gap-2">
          <HardDrive class="w-4 h-4 text-warm-primary" />
          Cadangan & Kelola Data
        </h3>

        <button
          type="button"
          onClick={handleExportCsv}
          class="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-warm-border bg-warm-subtle/70 hover:bg-warm-subtle text-xs font-bold text-warm-ink transition-all active:scale-[0.98] shadow-sm"
        >
          <FileSpreadsheet class="w-4 h-4 text-warm-primary" />
          <span>Ekspor Data ke Sheet (CSV)</span>
        </button>
        <p class="text-[10.5px] text-warm-mute mt-1.5 text-center leading-normal">
          File .csv kompatibel langsung dengan Google Sheets, Microsoft Excel, dan Numbers.
        </p>

        <Show when={csvExportStatus().message}>
          <div
            class={`mt-2.5 p-2 rounded-xl text-[11px] font-semibold text-center animate-fadeIn ${
              csvExportStatus().success
                ? 'bg-cat-health-soft text-cat-health'
                : 'bg-cat-bills-soft text-cat-bills'
            }`}
          >
            {csvExportStatus().message}
          </div>
        </Show>

        <div class="mt-4 pt-4 border-t border-warm-border">
          <button
            type="button"
            onClick={handleOpenClearModal}
            class="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-xs font-semibold transition-colors active:scale-[0.98]"
          >
            <Trash2 class="w-4 h-4" />
            <span>Hapus Semua Data</span>
          </button>
        </div>
      </div>

      {/* MODAL PANDUAN SERVICE ACCOUNT */}
      <ServiceAccountGuideModal
        isOpen={showGuideModal()}
        onClose={() => setShowGuideModal(false)}
      />

      {/* MODAL VERIFIKASI HAPUS SEMUA DATA */}
      <Show when={showClearModal()}>
        <div
          class="fixed inset-0 z-[100] bg-warm-ink/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowClearModal(false);
              setClearConfirmText('');
            }
          }}
        >
          <div class="bg-warm-card border border-warm-border rounded-2xl p-5 max-w-xs w-full shadow-2xl animate-scaleUp relative">
            {/* Tombol Tutup */}
            <button
              type="button"
              onClick={() => {
                setShowClearModal(false);
                setClearConfirmText('');
              }}
              class="absolute top-3.5 right-3.5 p-1 rounded-lg text-warm-mute hover:text-warm-ink hover:bg-warm-subtle transition-colors"
              title="Tutup"
            >
              <X class="w-4 h-4" />
            </button>

            {/* Icon Tong Sampah Merah Lembut */}
            <div class="w-12 h-12 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
              <Trash2 class="w-6 h-6" />
            </div>

            {/* Judul & Keterangan */}
            <div class="text-center mb-4">
              <h3 class="text-base font-bold text-warm-ink mb-1.5">
                Hapus Semua Data?
              </h3>
              <p class="text-xs text-warm-mute leading-relaxed">
                Tindakan ini akan menghapus seluruh catatan transaksi di perangkat Anda secara permanen.
              </p>
            </div>

            {/* Instruksi Verifikasi Pengetikan */}
            <div class="mb-4">
              <label class="text-[11px] font-semibold text-warm-mute block mb-1.5 text-left">
                Ketik <strong class="text-red-500 font-mono select-all">hapus semua data</strong> untuk konfirmasi:
              </label>
              <input
                type="text"
                placeholder='hapus semua data'
                value={clearConfirmText()}
                onInput={(e) => setClearConfirmText(e.currentTarget.value)}
                class="w-full text-xs p-2.5 bg-warm-subtle border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-red-400 font-medium placeholder:text-warm-faint"
                autofocus
              />
            </div>

            {/* Tombol Aksi */}
            <div class="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setClearConfirmText('');
                }}
                class="flex-1 py-2.5 px-3 rounded-xl border border-warm-border bg-warm-card text-warm-ink hover:bg-warm-subtle text-xs font-bold transition-all active:scale-[0.98]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={clearConfirmText().trim().toLowerCase() !== 'hapus semua data' || isClearing()}
                onClick={async () => {
                  setIsClearing(true);
                  try {
                    await db.clearAll();
                    await loadExpensesForSelectedMonth();
                    await updateSettings({
                      hasSeenOnboarding: false,
                      userName: '',
                      monthlyIncome: 0,
                      currentBalance: 0,
                      dailyBudget: 0,
                    });
                    setShowClearModal(false);
                    setClearConfirmText('');
                  } catch (err: any) {
                    alert('Gagal membersihkan data: ' + err.message);
                  } finally {
                    setIsClearing(false);
                  }
                }}
                class="flex-1 py-2.5 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-[0_2px_8px_rgba(239,68,68,0.25)] active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                {isClearing() ? 'Menghapus...' : 'Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

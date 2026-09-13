import { Component, createSignal, Show, For } from 'solid-js';
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
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  HelpCircle,
  Calculator,
  ChevronDown,
  X,
  Tag,
  Plus,
  Upload,
} from 'lucide-solid';
import { categories, removeCategory } from '../stores/categoryStore';
import { CategoryIcon } from './CategoryIcon';
import { AddCategoryModal } from './AddCategoryModal';
import { Category } from '../types';

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
  let fileInputRef: HTMLInputElement | undefined;

  const handleFileUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (!parsed.client_email || !parsed.private_key) {
            setSaTestStatus({
              success: false,
              message: 'File JSON tidak valid: harus memiliki "client_email" dan "private_key".',
            });
            return;
          }
          setSaJsonInput(content);
          await setServiceAccountConfig(content, sheetIdInput());
          setSaTestStatus({
            success: true,
            message: `File JSON berhasil diunggah untuk: ${parsed.client_email}`,
          });
        } catch (err: any) {
          setSaTestStatus({
            success: false,
            message: 'Gagal membaca file JSON: ' + err.message,
          });
        }
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  // State Kelola Kategori
  const [showAddCategoryModal, setShowAddCategoryModal] = createSignal(false);
  const [categoryDeleteError, setCategoryDeleteError] = createSignal('');

  const handleDeleteCategory = async (cat: Category) => {
    if (cat.isDefault) return;
    if (!confirm(`Hapus kategori "${cat.name}"? Pengeluaran yang sudah ada dengan kategori ini akan tetap tersimpan.`)) {
      return;
    }

    try {
      setCategoryDeleteError('');
      await removeCategory(cat.id);
    } catch (err: any) {
      setCategoryDeleteError(err.message || 'Gagal menghapus kategori');
    }
  };

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
      <h2 class="text-base font-bold text-warm-ink mb-3.5">Pengaturan</h2>

      {/* METODE SINKRONISASI (COLLAPSIBLE) */}
      <div class="bg-warm-card border border-warm-border rounded-2xl mb-3.5 shadow-[0_1px_3px_rgba(45,40,37,0.03)] overflow-hidden transition-all">
        {/* Accordion Toggle Header */}
        <button
          type="button"
          onClick={() => setIsSyncOpen(!isSyncOpen())}
          class="w-full p-3.5 flex items-center justify-between text-left hover:bg-warm-subtle/50 transition-colors"
        >
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-warm-subtle border border-warm-border flex items-center justify-center shrink-0">
              <Cloud class="w-3.5 h-3.5 text-warm-primary" />
            </div>
            <h3 class="text-xs font-bold text-warm-ink">
              Sinkronisasi Cloud
            </h3>
          </div>
          <div class="flex items-center gap-2">
            <span class={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              syncStatus() === 'synced'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-warm-subtle text-warm-mute border border-warm-border'
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
          <div class="p-3.5 pt-0 border-t border-warm-border/60">
            <div class="space-y-2.5 pt-3">
              {/* Opsi 1: Google Service Account */}
              <label class={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                settings().syncMode === 'service_account'
                  ? 'bg-warm-subtle/60 border-warm-primary'
                  : 'border-warm-border hover:bg-warm-subtle/30'
              }`}>
                <input
                  type="radio"
                  name="syncMode"
                  checked={settings().syncMode === 'service_account'}
                  onChange={() => setSyncMode('service_account')}
                  class="mt-0.5 accent-warm-primary"
                />
                <div class="flex-1">
                  <span class="text-xs font-bold text-warm-ink block">
                    Google Service Account
                  </span>

                  <Show when={settings().syncMode === 'service_account'}>
                    <div class="mt-2.5 pt-2.5 border-t border-warm-border/70 space-y-2.5">
                      {/* Upload & Input JSON */}
                      <div>
                        <div class="flex items-center justify-between mb-1.5">
                          <label class="text-[11px] font-semibold text-warm-mute">
                            Kunci JSON
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowGuideModal(true)}
                            class="text-[10px] text-warm-primary hover:underline font-bold flex items-center gap-1"
                          >
                            <HelpCircle class="w-3 h-3" />
                            <span>Panduan</span>
                          </button>
                        </div>

                        <div class="mb-2">
                          <input
                            type="file"
                            accept=".json,application/json"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            class="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef?.click()}
                            class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-warm-primary bg-warm-card hover:bg-warm-subtle text-warm-ink text-xs font-semibold transition-all active:scale-[0.99]"
                          >
                            <Upload class="w-3.5 h-3.5 text-warm-primary" />
                            <span>Upload File JSON</span>
                          </button>
                        </div>

                        <textarea
                          placeholder="Atau tempel teks JSON di sini..."
                          value={saJsonInput()}
                          onInput={(e) => setSaJsonInput(e.currentTarget.value)}
                          rows={6}
                          class="w-full text-[11px] p-2.5 bg-warm-card border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary font-mono placeholder:text-warm-faint min-h-[140px] resize-y"
                        ></textarea>
                      </div>

                      {/* Email bot penerima share */}
                      <Show when={currentBotEmail()}>
                        <div class="p-2 bg-warm-card border border-warm-border rounded-lg text-[11px]">
                          <span class="text-[10px] text-warm-mute block mb-1">
                            Email Bot (Beri akses Editor):
                          </span>
                          <div class="flex items-center justify-between gap-2 bg-warm-canvas/80 p-1.5 rounded border border-warm-border">
                            <code class="text-[10px] text-warm-ink font-mono break-all select-all">
                              {currentBotEmail()}
                            </code>
                            <button
                              type="button"
                              onClick={handleCopyEmail}
                              class="p-1 text-warm-primary hover:text-warm-primary-dark shrink-0 flex items-center gap-1 text-[10px] font-semibold"
                            >
                              {copiedEmail() ? <Check class="w-3 h-3 text-sync-synced" /> : <Copy class="w-3 h-3" />}
                              <span>{copiedEmail() ? 'Disalin' : 'Salin'}</span>
                            </button>
                          </div>
                        </div>
                      </Show>

                      {/* Kolom Link / ID Google Sheet */}
                      <div>
                        <label class="text-[11px] font-semibold text-warm-mute block mb-1">
                          Link atau ID Google Sheet
                        </label>
                        <input
                          type="text"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          value={sheetIdInput()}
                          onInput={(e) => setSheetIdInput(e.currentTarget.value)}
                          class="w-full text-xs p-2 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint font-mono"
                        />
                      </div>

                      {/* Tombol Simpan & Tes Koneksi */}
                      <button
                        type="button"
                        onClick={handleTestServiceAccount}
                        disabled={isSaTesting()}
                        class="w-full py-2 px-3 bg-warm-primary text-white text-xs font-semibold rounded-lg hover:bg-warm-primary-dark transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw class={`w-3 h-3 ${isSaTesting() ? 'animate-spin' : ''}`} />
                        <span>{isSaTesting() ? 'Menguji...' : 'Simpan & Tes Koneksi'}</span>
                      </button>

                      {/* Feedback Hasil Tes */}
                      <Show when={saTestStatus().message}>
                        <div
                          class={`p-2 rounded-lg text-xs font-medium flex items-start gap-1.5 ${
                            saTestStatus().success
                              ? 'bg-cat-health-soft text-cat-health'
                              : 'bg-cat-bills-soft text-cat-bills'
                          }`}
                        >
                          <Show
                            when={saTestStatus().success}
                            fallback={<AlertCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                          >
                            <CheckCircle2 class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          </Show>
                          <span class="flex-1">{saTestStatus().message}</span>
                        </div>
                      </Show>

                      {/* Tautan langsung ke file Sheet jika sudah ada */}
                      <Show when={settings().spreadsheetId}>
                        <div class="pt-0.5 flex items-center justify-between text-[11px]">
                          <span class="text-warm-mute">Google Sheet:</span>
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${settings().spreadsheetId}`}
                            target="_blank"
                            class="text-warm-ink hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Link2 class="w-3 h-3 text-warm-primary" />
                            <span>Buka di Sheets</span>
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
                  ? 'bg-warm-subtle/60 border-warm-primary'
                  : 'border-warm-border hover:bg-warm-subtle/30'
              }`}>
                <input
                  type="radio"
                  name="syncMode"
                  checked={settings().syncMode === 'apps_script'}
                  onChange={() => setSyncMode('apps_script')}
                  class="mt-0.5 accent-warm-primary"
                />
                <div class="flex-1">
                  <span class="text-xs font-bold text-warm-ink block">
                    Custom Webhook (Apps Script)
                  </span>

                  <Show when={settings().syncMode === 'apps_script'}>
                    <div class="mt-2.5 pt-2.5 border-t border-warm-border/70 space-y-2">
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={settings().scriptUrl || ''}
                        onInput={(e) => setScriptUrl(e.currentTarget.value)}
                        class="w-full text-xs p-2 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-mono placeholder:text-warm-faint"
                      />

                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting()}
                        class="px-3 py-1.5 bg-warm-subtle text-warm-ink border border-warm-border text-xs font-semibold rounded-lg hover:bg-warm-border transition-colors disabled:opacity-50"
                      >
                        {isTesting() ? 'Menguji...' : 'Tes Koneksi'}
                      </button>

                      <Show when={testStatus().message}>
                        <div
                          class={`p-2 rounded text-xs font-medium ${
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
            <div class="mt-3 pt-3 border-t border-warm-border flex items-center justify-between">
              <span class="text-[11px] text-warm-mute">
                Status: <strong class="text-warm-ink capitalize">{syncStatus()}</strong>
              </span>
              <button
                onClick={handleForceSync}
                disabled={isSyncing()}
                class="px-3 py-1.5 bg-warm-primary text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-warm-primary-dark transition-colors disabled:opacity-50"
              >
                <RefreshCw class={`w-3 h-3 ${isSyncing() ? 'animate-spin' : ''}`} />
                <span>Sinkron Sekarang</span>
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* PENGATURAN BUDGET & PROFIL */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-4 mb-3.5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <h3 class="text-xs font-bold text-warm-ink mb-3 flex items-center gap-2">
          <Calculator class="w-3.5 h-3.5 text-warm-primary" />
          <span>Profil & Budget</span>
        </h3>

        <div class="space-y-2.5">
          <div>
            <label class="text-[11px] font-semibold text-warm-mute block mb-1">
              Nama
            </label>
            <input
              type="text"
              placeholder="Yoga"
              value={userNameInput()}
              onInput={(e) => setUserNameInput(e.currentTarget.value)}
              class="w-full text-xs p-2 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-medium placeholder:text-warm-faint"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-warm-mute block mb-1">
              Penghasilan Bulanan
            </label>
            <input
              type="text"
              placeholder="5.000.000"
              value={userIncomeInput()}
              onInput={(e) => {
                const raw = e.currentTarget.value.replace(/\D/g, '');
                setUserIncomeInput(raw ? new Intl.NumberFormat('id-ID').format(Number(raw)) : '');
              }}
              class="w-full text-xs p-2 bg-warm-card border border-warm-border rounded-lg text-warm-ink focus:outline-none focus:border-warm-primary font-bold placeholder:text-warm-faint"
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
              setBudgetSaveMessage('Berhasil disimpan');
              setTimeout(() => setBudgetSaveMessage(''), 2500);
            }}
            class="w-full mt-1 py-2 px-3 bg-warm-primary text-white text-xs font-semibold rounded-lg hover:bg-warm-primary-dark transition-colors flex items-center justify-center"
          >
            <span>Simpan</span>
          </button>

          <Show when={budgetSaveMessage()}>
            <div class="p-1.5 bg-cat-health-soft text-cat-health rounded-lg text-[11px] font-semibold text-center">
              {budgetSaveMessage()}
            </div>
          </Show>
        </div>
      </div>

      {/* KELOLA KATEGORI */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-4 mb-3.5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <div class="flex items-center justify-between mb-2.5">
          <h3 class="text-xs font-bold text-warm-ink flex items-center gap-2">
            <Tag class="w-3.5 h-3.5 text-warm-primary" />
            <span>Kategori</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowAddCategoryModal(true)}
            class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-warm-primary text-white text-xs font-semibold hover:bg-warm-primary-dark transition-colors"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        <Show when={categoryDeleteError()}>
          <p class="text-xs text-cat-bills font-medium mb-2">{categoryDeleteError()}</p>
        </Show>

        <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          <For each={categories()}>
            {(cat) => (
              <div class="flex items-center justify-between p-2 bg-warm-canvas/60 border border-warm-border/60 rounded-xl">
                <div class="flex items-center gap-2">
                  <div
                    class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ 'background-color': cat.softColor }}
                  >
                    <CategoryIcon
                      name={cat.icon}
                      class="w-3 h-3"
                      style={{ color: cat.color }}
                    />
                  </div>
                  <span class="text-xs font-bold text-warm-ink">{cat.name}</span>
                </div>

                <div class="flex items-center gap-2">
                  <Show
                    when={!cat.isDefault}
                    fallback={
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warm-subtle text-warm-mute">
                        Bawaan
                      </span>
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      class="p-1 text-warm-mute hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus Kategori"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* MANAJEMEN DATA & CADANGAN */}
      <div class="bg-warm-card border border-warm-border rounded-2xl p-4 mb-3.5 shadow-[0_1px_3px_rgba(45,40,37,0.03)]">
        <h3 class="text-xs font-bold text-warm-ink mb-2.5 flex items-center gap-2">
          <HardDrive class="w-3.5 h-3.5 text-warm-primary" />
          <span>Data & Cadangan</span>
        </h3>

        <button
          type="button"
          onClick={handleExportCsv}
          class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-warm-border bg-warm-subtle/50 hover:bg-warm-subtle text-xs font-semibold text-warm-ink transition-all active:scale-[0.98]"
        >
          <FileSpreadsheet class="w-3.5 h-3.5 text-warm-primary" />
          <span>Ekspor Transaksi (CSV)</span>
        </button>

        <Show when={csvExportStatus().message}>
          <div
            class={`mt-2 p-1.5 rounded-xl text-[11px] font-semibold text-center animate-fadeIn ${
              csvExportStatus().success
                ? 'bg-cat-health-soft text-cat-health'
                : 'bg-cat-bills-soft text-cat-bills'
            }`}
          >
            {csvExportStatus().message}
          </div>
        </Show>

        <div class="mt-3 pt-3 border-t border-warm-border">
          <button
            type="button"
            onClick={handleOpenClearModal}
            class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-xs font-semibold transition-colors active:scale-[0.98]"
          >
            <Trash2 class="w-3.5 h-3.5" />
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
                      initialBalance: 0,
                      initialBalanceMonth: '',
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

      {/* Modal Tambah Kategori */}
      <AddCategoryModal
        isOpen={showAddCategoryModal()}
        onClose={() => setShowAddCategoryModal(false)}
      />
    </div>
  );
};

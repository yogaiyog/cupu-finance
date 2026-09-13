import { Component, createSignal, Show } from 'solid-js';
import {
  settings,
  setHasSeenOnboarding,
  setUserName,
  setMonthlyIncome,
  setCurrentBalance,
  setDailyBudget,
  setServiceAccountConfig,
  setSpreadsheetId,
} from '../stores/settingsStore';
import { serviceAccountSyncProvider } from '../services/sync/serviceAccountSync';
import { ServiceAccountGuideModal } from './ServiceAccountGuideModal';
import { addExpense } from '../stores/expenseStore';
import logoImg from '../assets/logo.png';
import {
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Calendar,
  Sparkles,
} from 'lucide-solid';

interface OnboardingViewProps {
  onComplete?: () => void;
}

export const OnboardingView: Component<OnboardingViewProps> = (props) => {
  // Slide Carousel: 1 (Brand/Logo), 2 (Nama & Penghasilan), 3 (Kalkulasi Budget)
  const [currentSlide, setCurrentSlide] = createSignal<1 | 2 | 3>(1);

  const [nameInput, setNameInput] = createSignal(settings().userName || '');
  const [incomeInput, setIncomeInput] = createSignal(
    settings().monthlyIncome ? new Intl.NumberFormat('id-ID').format(settings().monthlyIncome!) : ''
  );
  const [balanceInput, setBalanceInput] = createSignal(
    settings().currentBalance
      ? new Intl.NumberFormat('id-ID').format(settings().currentBalance!)
      : settings().monthlyIncome
      ? new Intl.NumberFormat('id-ID').format(settings().monthlyIncome!)
      : ''
  );

  // Modal Service Account & Guide
  const [showConnectModal, setShowConnectModal] = createSignal(false);
  const [showGuideModal, setShowGuideModal] = createSignal(false);
  const [jsonInput, setJsonInput] = createSignal(settings().serviceAccountJson || '');
  const [sheetInput, setSheetInput] = createSignal(settings().spreadsheetId || '');
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [connectError, setConnectError] = createSignal('');

  // Perhitungan sisa hari bulan ini
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();
  const daysRemaining = Math.max(1, totalDaysInMonth - todayDate + 1); // Termasuk hari ini

  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const currentMonthName = monthNames[month];

  // Helper format input rupiah
  const handleIncomeInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const raw = e.currentTarget.value.replace(/\D/g, '');
    if (!raw) {
      setIncomeInput('');
      return;
    }
    const formatted = new Intl.NumberFormat('id-ID').format(Number(raw));
    setIncomeInput(formatted);
    // Jika balance belum pernah diisi manual, auto-isi dengan nilai yang sama
    if (!balanceInput()) {
      setBalanceInput(formatted);
    }
  };

  const handleBalanceInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const raw = e.currentTarget.value.replace(/\D/g, '');
    if (!raw) {
      setBalanceInput('');
      return;
    }
    const formatted = new Intl.NumberFormat('id-ID').format(Number(raw));
    setBalanceInput(formatted);
  };

  const parsedIncome = () => {
    const raw = incomeInput().replace(/\D/g, '');
    return raw ? Number(raw) : 0;
  };

  const parsedBalance = () => {
    const raw = balanceInput().replace(/\D/g, '');
    if (raw) return Number(raw);
    return parsedIncome(); // fallback ke income jika kosong
  };

  // Budget harian agar bertahan sampai akhir bulan = Sisa Uang ÷ Sisa Hari
  const dailyBudgetRemaining = () => {
    const bal = parsedBalance();
    return bal > 0 ? Math.round(bal / daysRemaining) : 0;
  };

  // Budget rata-rata 1 bulan penuh (30 hari)
  const dailyBudgetFullMonth = () => {
    const inc = parsedIncome();
    return inc > 0 ? Math.round(inc / totalDaysInMonth) : 0;
  };

  const formatRp = (num: number) => {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(num);
  };

  // Selesai onboarding dan masuk ke aplikasi
  const handleFinishOnboarding = async () => {
    if (nameInput().trim()) {
      await setUserName(nameInput().trim());
    }
    const inc = parsedIncome();
    const bal = parsedBalance();
    if (inc > 0) {
      await setMonthlyIncome(inc);
    }
    if (bal > 0) {
      await setCurrentBalance(bal);
      await setDailyBudget(dailyBudgetRemaining());
    }

    // Otomatis mencatat pengeluaran sebesar penghasilan - sisa uang jika ada selisih
    if (inc > 0 && bal > 0 && inc > bal) {
      const diff = inc - bal;
      const todayStr = new Date().toISOString().split('T')[0];
      await addExpense({
        amount: diff,
        category: 'Lainnya',
        note: 'pengeluaran terakhir',
        date: todayStr,
      });
    }

    await setHasSeenOnboarding(true);
    if (props.onComplete) {
      props.onComplete();
    }
  };

  // Hubungkan Google Sheets via Service Account JSON
  const handleConnectServiceAccount = async () => {
    if (!jsonInput().trim()) {
      setConnectError('Harap paste teks JSON Service Account Anda.');
      return;
    }
    if (!sheetInput().trim()) {
      setConnectError('Harap masukkan Link atau ID Google Sheet Anda.');
      return;
    }

    setIsConnecting(true);
    setConnectError('');

    try {
      const saveRes = await setServiceAccountConfig(jsonInput().trim(), sheetInput().trim());
      if (!saveRes.success) {
        setConnectError(saveRes.error || 'JSON tidak valid.');
        setIsConnecting(false);
        return;
      }

      await setSpreadsheetId(sheetInput().trim());

      const testRes = await serviceAccountSyncProvider.testConnection(
        jsonInput().trim(),
        sheetInput().trim()
      );

      if (testRes.success) {
        if (nameInput().trim()) {
          await setUserName(nameInput().trim());
        }
        const inc = parsedIncome();
        const bal = parsedBalance();
        if (inc > 0) {
          await setMonthlyIncome(inc);
        }
        if (bal > 0) {
          await setCurrentBalance(bal);
          await setDailyBudget(dailyBudgetRemaining());
        }

        // Otomatis mencatat pengeluaran sebesar penghasilan - sisa uang jika ada selisih
        if (inc > 0 && bal > 0 && inc > bal) {
          const diff = inc - bal;
          const todayStr = new Date().toISOString().split('T')[0];
          await addExpense({
            amount: diff,
            category: 'Lainnya',
            note: 'pengeluaran terakhir',
            date: todayStr,
          });
        }

        await setHasSeenOnboarding(true);
        setShowConnectModal(false);
        if (props.onComplete) {
          props.onComplete();
        }
      } else {
        setConnectError(testRes.message);
      }
    } catch (err: any) {
      setConnectError(err.message || 'Gagal menghubungkan Google Sheet.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 bg-warm-canvas text-warm-ink flex flex-col items-center justify-between p-6 max-w-md mx-auto overflow-y-auto">
      {/* ========================================================
          SLIDE 1: LOGO & BRANDING BERSIH
      ======================================================== */}
      {/* ========================================================
          SLIDE 1: LOGO & BRANDING BERSIH (HANYA LOGO, H1 & H3)
      ======================================================== */}
      <Show when={currentSlide() === 1}>
        <div class="w-full flex-1 flex flex-col items-center justify-between animate-fadeIn py-4">
          {/* TENGAH: LOGO, H1 & H3 */}
          <div class="w-full flex-1 flex flex-col items-center justify-center text-center">
            <img
              src={logoImg}
              alt="Cupu Finance Logo"
              class="w-44 h-44 object-contain drop-shadow-md mb-6"
            />
            <h1 class="text-3xl font-extrabold text-warm-ink tracking-tight mb-2">
              Cupu Finance
            </h1>
            <h3 class="text-sm font-semibold text-warm-primary tracking-wide">
              Catat Uang Paling Unyu
            </h3>
          </div>

          {/* BAWAH: NAVIGASI KE SLIDE 2 */}
          <div class="w-full pb-2">
            <button
              onClick={() => setCurrentSlide(2)}
              class="w-full h-12 bg-warm-primary hover:bg-warm-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(213,189,175,0.4)] active:scale-[0.98] transition-all"
            >
              <span>Lanjut ke Pengaturan Budget</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
        </div>
      </Show>

      {/* ========================================================
          SLIDE 2: INPUT NAMA & PENGHASILAN BULANAN
      ======================================================== */}
      <Show when={currentSlide() === 2}>
        <div class="w-full flex-1 flex flex-col items-center justify-between animate-fadeIn">
          {/* ATAS: HEADER SLIDE 2 */}
          {/* <div class="w-full pt-6 text-center">
            <div class="w-14 h-14 rounded-2xl bg-warm-card border border-warm-border shadow-[0_2px_10px_rgba(213,189,175,0.2)] flex items-center justify-center mx-auto mb-3 text-warm-primary">
              <Calculator class="w-6 h-6" />
            </div>
            <h2 class="text-xl font-bold text-warm-ink tracking-tight mb-1">
              Kenalan Dulu Yuk
            </h2>
            <p class="text-xs text-warm-mute max-w-xs mx-auto leading-relaxed">
              Biar Cupu Finance bisa bantu hitung batas aman uang yang bisa kamu belanjakan setiap hari.
            </p>
          </div> */}

          {/* TENGAH: FORM INPUT */}
          <div class="w-full my-auto space-y-4 max-w-sm">
            {/* Input Nama */}
            <div>
              <label class="text-[11px] font-bold text-warm-mute block mb-1.5 uppercase tracking-wider">
                Nama Panggilan
              </label>
              <input
                type="text"
                placeholder="Contoh: Yoga"
                value={nameInput()}
                onInput={(e) => setNameInput(e.currentTarget.value)}
                class="w-full text-xs p-3.5 bg-warm-card border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint font-medium shadow-sm"
              />
            </div>

            {/* Input Penghasilan Bulanan */}
            <div>
              <label class="text-[11px] font-bold text-warm-mute block mb-1.5 uppercase tracking-wider">
                Penghasilan bulanan
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-warm-mute">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="5.000.000"
                  value={incomeInput()}
                  onInput={handleIncomeInput}
                  class="w-full text-sm font-bold pl-11 pr-3.5 py-3.5 bg-warm-card border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint shadow-sm"
                />
              </div>
              {/* <p class="text-[10px] text-warm-mute mt-1.5 leading-normal">
                Uang yang kamu alokasikan untuk belanja sampai akhir bulan {currentMonthName}.
              </p> */}
            </div>
            {/* Input Sisa Uang Saat Ini */}
            <div>
              <label class="text-[11px] font-bold text-warm-mute block mb-1.5 uppercase tracking-wider">
                Uang kamu tinggal berapa sekarang? 
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-warm-mute">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="2.000.000"
                  value={balanceInput()}
                  onInput={handleBalanceInput}
                  class="w-full text-sm font-bold pl-11 pr-3.5 py-3.5 bg-warm-card border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint shadow-sm"
                />
              </div>
              <p class="text-[10px] text-warm-mute mt-1.5 leading-normal">
                Uang yang kamu miliki saat ini sampai akhir bulan {currentMonthName}.
              </p>
            </div>
          </div>

          {/* BAWAH: NAVIGASI */}
          <div class="w-full pb-2 space-y-2">
            <button
              onClick={() => {
                if (parsedBalance() <= 0 && parsedIncome() <= 0) {
                  alert('Harap masukkan nominal sisa uang atau penghasilan Anda.');
                  return;
                }
                setCurrentSlide(3);
              }}
              class="w-full h-12 bg-warm-primary hover:bg-warm-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(213,189,175,0.4)] active:scale-[0.98] transition-all"
            >
              <span>Hitung Budget Harian Saya</span>
              <Sparkles class="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentSlide(1)}
              class="w-full h-10 text-warm-mute hover:text-warm-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          </div>
        </div>
      </Show>

      {/* ========================================================
          SLIDE 3: HASIL HITUNGAN BUDGET HARIAN & AKSI
      ======================================================== */}
      <Show when={currentSlide() === 3}>
        <div class="w-full flex-1 flex flex-col items-center justify-between animate-fadeIn">
          {/* ATAS: HEADER */}
          <div class="w-full pt-4 text-center">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cat-health-soft text-cat-health border border-cat-health/20 text-[11px] font-bold mb-2">
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>Kalkulasi Siap</span>
            </div>
            <h2 class="text-xl font-bold text-warm-ink tracking-tight mb-1">
              Batas Budget Harian {nameInput() ? nameInput() : 'Kamu'}
            </h2>
            <p class="text-xs text-warm-mute max-w-xs mx-auto leading-relaxed">
              Batas belanja per hari agar sisa uangmu cukup sampai akhir bulan {currentMonthName}.
            </p>
          </div>

          {/* TENGAH: KARTU UTAMA HASIL KALKULASI */}
          <div class="w-full my-auto space-y-3 max-w-sm">
            {/* Card Utama: Budget Harian Berdasarkan Sisa Uang */}
            <div class="p-5 bg-warm-card border-2 border-warm-primary/40 rounded-2xl shadow-[0_4px_16px_rgba(213,189,175,0.2)] text-center relative overflow-hidden">
              <div class="text-[10.5px] font-bold text-warm-mute uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                <Calendar class="w-3.5 h-3.5 text-warm-primary" />
                <span>Batas Belanja per Hari</span>
              </div>

              {/* Nominal Harian */}
              <div class="text-2xl font-black text-warm-primary my-2 tracking-tight">
                {formatRp(dailyBudgetRemaining())}
                <span class="text-xs font-bold text-warm-mute font-normal"> / hari</span>
              </div>

              <div class="pt-2.5 border-t border-warm-border/60 flex items-center justify-between text-[11px] text-warm-mute">
                <span>Sisa uang saat ini:</span>
                <strong class="text-warm-ink font-semibold">{formatRp(parsedBalance())}</strong>
              </div>
              <div class="pt-1 flex items-center justify-between text-[11px] text-warm-mute">
                <span>Sisa waktu bulan ini:</span>
                <strong class="text-warm-ink font-semibold">{daysRemaining} hari lagi</strong>
              </div>
              <Show when={parsedIncome() > 0}>
                <div class="pt-1 flex items-center justify-between text-[11px] text-warm-mute">
                  <span>Penghasilan bulanan:</span>
                  <strong class="text-warm-ink font-semibold">{formatRp(parsedIncome())}</strong>
                </div>
              </Show>
            </div>

            {/* Card Sekunder: Perbandingan Rata-rata 1 Bulan Penuh */}
            <Show when={parsedIncome() > 0}>
              <div class="p-3 bg-warm-subtle border border-warm-border rounded-xl flex items-center justify-between text-[11px]">
                <span class="text-warm-mute">Rata-rata standar 1 bulan ({totalDaysInMonth} hari):</span>
                <strong class="text-warm-ink font-semibold">{formatRp(dailyBudgetFullMonth())} / hari</strong>
              </div>
            </Show>

            <div class="text-center">
              <button
                onClick={() => setCurrentSlide(2)}
                class="text-[11px] text-warm-primary hover:underline font-semibold"
              >
                Ubah data keuangan
              </button>
            </div>
          </div>

          {/* BAWAH: AKSI SELESAI */}
          <div class="w-full pb-2 space-y-2">
            {/* Tombol Masuk Offline */}
            <button
              onClick={handleFinishOnboarding}
              class="w-full h-12 bg-warm-primary hover:bg-warm-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(213,189,175,0.4)] active:scale-[0.98] transition-all"
            >
              <span>Mulai Catat Transaksi</span>
              <ArrowRight class="w-4 h-4" />
            </button>

            {/* Tombol Koneksi Google Sheets */}
            <button
              onClick={() => setShowConnectModal(true)}
              class="w-full h-10 bg-warm-card hover:bg-warm-subtle text-warm-ink border border-warm-border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <FileSpreadsheet class="w-4 h-4 text-warm-primary" />
              <span>Hubungkan Google Sheet (Kunci JSON)</span>
            </button>
          </div>
        </div>
      </Show>

      {/* ========================================================
          DOTS INDIKATOR SLIDE DI PALING BAWAH
      ======================================================== */}
      <div class="flex items-center justify-center gap-1.5 pt-2 pb-1 shrink-0">
        <div
          class={`h-1.5 rounded-full transition-all duration-300 ${
            currentSlide() === 1 ? 'w-6 bg-warm-primary' : 'w-1.5 bg-warm-border'
          }`}
        />
        <div
          class={`h-1.5 rounded-full transition-all duration-300 ${
            currentSlide() === 2 ? 'w-6 bg-warm-primary' : 'w-1.5 bg-warm-border'
          }`}
        />
        <div
          class={`h-1.5 rounded-full transition-all duration-300 ${
            currentSlide() === 3 ? 'w-6 bg-warm-primary' : 'w-1.5 bg-warm-border'
          }`}
        />
      </div>

      {/* ========================================================
          MODAL INPUT SERVICE ACCOUNT JSON & GOOGLE SHEET
      ======================================================== */}
      <Show when={showConnectModal()}>
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-warm-card border border-warm-border rounded-2xl max-w-sm w-full p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-xs font-bold text-warm-ink flex items-center gap-1.5">
                <KeyRound class="w-4 h-4 text-warm-primary" />
                <span>Koneksi Google Sheets via JSON</span>
              </h4>
              <button
                onClick={() => setShowConnectModal(false)}
                class="p-1 text-warm-mute hover:text-warm-ink rounded-lg"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            <p class="text-[11px] text-warm-mute mb-3 leading-relaxed">
              Paste teks JSON Service Account dari Google Cloud Anda dan link Google Sheet tujuan:
            </p>

            <div class="space-y-3 mb-4">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-bold text-warm-mute uppercase tracking-wider">
                    Isi Kunci JSON Service Account
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    class="text-[10px] text-warm-primary hover:underline font-bold flex items-center gap-1"
                  >
                    <HelpCircle class="w-3 h-3" />
                    <span>Cara Mendapatkannya</span>
                  </button>
                </div>
                <textarea
                  placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
                  value={jsonInput()}
                  onInput={(e) => setJsonInput(e.currentTarget.value)}
                  rows={4}
                  class="w-full text-[11px] p-2.5 bg-warm-subtle border border-warm-border rounded-xl text-warm-ink font-mono focus:outline-none focus:border-warm-primary placeholder:text-warm-faint resize-none"
                ></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold text-warm-mute uppercase tracking-wider block mb-1">
                  Link atau ID Google Sheet
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetInput()}
                  onInput={(e) => setSheetInput(e.currentTarget.value)}
                  class="w-full text-xs p-2.5 bg-warm-subtle border border-warm-border rounded-xl text-warm-ink focus:outline-none focus:border-warm-primary placeholder:text-warm-faint font-mono"
                />
              </div>

              <Show when={connectError()}>
                <div class="p-2.5 bg-cat-bills-soft text-cat-bills rounded-xl text-[11px] font-medium flex items-start gap-1.5">
                  <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{connectError()}</span>
                </div>
              </Show>

              <div class="p-2.5 bg-warm-subtle/70 border border-warm-border rounded-xl text-[10.5px] text-warm-mute leading-relaxed">
                <strong>Penting:</strong> Di Google Sheet Anda, klik tombol <strong>Bagikan (Share)</strong> dan tambahkan alamat <code>client_email</code> dari JSON Anda sebagai <strong>Editor</strong>.
              </div>
            </div>

            <div class="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowConnectModal(false)}
                disabled={isConnecting()}
                class="px-3 py-2 text-xs text-warm-mute hover:text-warm-ink font-medium disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConnectServiceAccount}
                disabled={isConnecting()}
                class="px-4 py-2 bg-warm-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                <Show when={isConnecting()} fallback={<CheckCircle2 class="w-3.5 h-3.5" />}>
                  <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                </Show>
                <span>{isConnecting() ? 'Menghubungkan...' : 'Koneksikan & Masuk'}</span>
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* MODAL PANDUAN CARA DAPETIN JSON */}
      <ServiceAccountGuideModal
        isOpen={showGuideModal()}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
};

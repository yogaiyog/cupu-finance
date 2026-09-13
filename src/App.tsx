import { Component, createSignal, onMount, Switch, Match, Show } from 'solid-js';
import { initSettings, settings, isLoadingSettings } from './stores/settingsStore';
import { initNetworkListener } from './services/network';
import { initSyncManager } from './services/sync/syncManager';
import { loadExpensesForSelectedMonth } from './stores/expenseStore';
import { loadCategories } from './stores/categoryStore';
import { Navbar, ActiveTab } from './components/Navbar';
import { SyncBadge } from './components/SyncBadge';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { MonthlyRecap } from './components/MonthlyRecap';
import { SettingsView } from './components/SettingsView';
import { OnboardingView } from './components/OnboardingView';
import { DailyBudgetCard } from './components/DailyBudgetCard';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import logoImg from './assets/logo.png';

export const App: Component = () => {
  const [activeTab, setActiveTab] = createSignal<ActiveTab>('catat');
  const [isAppLoading, setIsAppLoading] = createSignal<boolean>(true);

  onMount(async () => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([
        initSettings(),
        initNetworkListener(),
        loadExpensesForSelectedMonth(),
        loadCategories(),
        minDelay,
      ]);
      initSyncManager();
    } catch (err) {
      console.error('Error saat inisialisasi aplikasi:', err);
    } finally {
      setIsAppLoading(false);
    }
  });

  return (
    <div class="min-h-screen bg-warm-canvas text-warm-ink flex flex-col items-center">
      {/* 1. BRANDED SPLASH / INITIAL LOADING SCREEN */}
      <Show when={isAppLoading()}>
        <div class="fixed inset-0 z-50 bg-warm-canvas flex flex-col items-center justify-between px-4 py-4 min-h-screen">
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
          </div>
        </div>
      </Show>

      {/* 2. TAMPILAN PERTAMA KALI (ONBOARDING SCREEN) */}
      <Show when={!isAppLoading() && !isLoadingSettings() && !settings().hasSeenOnboarding}>
        <OnboardingView />
      </Show>

      {/* Container Mobile Viewport */}
      <div class="w-full max-w-md min-h-screen flex flex-col bg-warm-canvas px-4 pt-3 pb-24 relative">
        {/* HEADER APLIKASI */}
        <header class="flex items-center justify-between py-3 mb-2 border-b border-warm-border/50">
          <div class="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="Cupu Finance"
              class="w-9 h-9 object-contain rounded-xl"
            />
            <div>
              <h1 class="text-base font-bold text-warm-ink tracking-tight leading-none">
                Cupu Finance
              </h1>
              <span class="text-[11px] font-medium text-warm-primary">
                {settings().userName ? `Hai, ${settings().userName}` : 'Catat Uang Paling Unyu'}
              </span>
            </div>
          </div>

          {/* BADGE SINKRONISASI */}
          <SyncBadge />
        </header>

        {/* KONTEN UTAMA SESUAI TAB AKTIF */}
        <main class="flex-1 mt-2">
          <Switch>
            {/* TAB 1: CATAT CEPAT & LIST HARI INI */}
            <Match when={activeTab() === 'catat'}>
              <div>
                <DailyBudgetCard />
                <ExpenseForm />
                <div class="mt-2">
                  {/* <h3 class="text-xs font-bold text-warm-mute uppercase tracking-wider px-1 mb-3">
                    Pengeluaran Hari Ini
                  </h3> */}
                  <ExpenseList todayOnly={true} />
                </div>
              </div>
            </Match>

            {/* TAB 2: REKAP BULANAN */}
            <Match when={activeTab() === 'rekap'}>
              <MonthlyRecap />
            </Match>

            {/* TAB 3: PENGATURAN */}
            <Match when={activeTab() === 'settings'}>
              <SettingsView />
            </Match>
          </Switch>
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <Navbar activeTab={activeTab()} onTabChange={setActiveTab} />
      </div>

      {/* MODAL KONFIRMASI HAPUS CATATAN KUSTOM */}
      <DeleteConfirmModal />
    </div>
  );
};

import { Component, createSignal, onMount, Switch, Match, Show } from 'solid-js';
import { initSettings, settings, isLoadingSettings } from './stores/settingsStore';
import { initNetworkListener } from './services/network';
import { initSyncManager } from './services/sync/syncManager';
import { loadExpensesForSelectedMonth } from './stores/expenseStore';
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

  onMount(async () => {
    await initSettings();
    await initNetworkListener();
    await loadExpensesForSelectedMonth();
    initSyncManager();
  });

  return (
    <div class="min-h-screen bg-warm-canvas text-warm-ink flex flex-col items-center">
      {/* TAMPILAN PERTAMA KALI (ONBOARDING SCREEN) */}
      <Show when={!isLoadingSettings() && !settings().hasSeenOnboarding}>
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

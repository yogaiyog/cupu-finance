import { Component } from 'solid-js';
import { PlusCircle, BarChart3, Settings } from 'lucide-solid';

export type ActiveTab = 'catat' | 'rekap' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Navbar: Component<NavbarProps> = (props) => {
  return (
    <nav class="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-warm-card/95 backdrop-blur-md border-t border-warm-border flex items-center justify-around px-4 z-30 select-none">
      {/* Tab Catat Cepat */}
      <button
        onClick={() => props.onTabChange('catat')}
        class={`flex flex-col items-center justify-center w-20 py-1 transition-all rounded-xl ${
          props.activeTab === 'catat'
            ? 'text-warm-ink font-semibold'
            : 'text-warm-mute hover:text-warm-ink'
        }`}
      >
        <div
          class={`p-1.5 rounded-full transition-colors ${
            props.activeTab === 'catat' ? 'bg-warm-primary text-white shadow-sm' : ''
          }`}
        >
          <PlusCircle class="w-5 h-5" />
        </div>
        <span class="text-[11px] mt-0.5">Catat</span>
      </button>

      {/* Tab Rekap Bulanan */}
      <button
        onClick={() => props.onTabChange('rekap')}
        class={`flex flex-col items-center justify-center w-20 py-1 transition-all rounded-xl ${
          props.activeTab === 'rekap'
            ? 'text-warm-ink font-semibold'
            : 'text-warm-mute hover:text-warm-ink'
        }`}
      >
        <div
          class={`p-1.5 rounded-full transition-colors ${
            props.activeTab === 'rekap' ? 'bg-warm-primary text-white shadow-sm' : ''
          }`}
        >
          <BarChart3 class="w-5 h-5" />
        </div>
        <span class="text-[11px] mt-0.5">Rekap</span>
      </button>

      {/* Tab Pengaturan */}
      <button
        onClick={() => props.onTabChange('settings')}
        class={`flex flex-col items-center justify-center w-20 py-1 transition-all rounded-xl ${
          props.activeTab === 'settings'
            ? 'text-warm-ink font-semibold'
            : 'text-warm-mute hover:text-warm-ink'
        }`}
      >
        <div
          class={`p-1.5 rounded-full transition-colors ${
            props.activeTab === 'settings' ? 'bg-warm-primary text-white shadow-sm' : ''
          }`}
        >
          <Settings class="w-5 h-5" />
        </div>
        <span class="text-[11px] mt-0.5">Pengaturan</span>
      </button>
    </nav>
  );
};

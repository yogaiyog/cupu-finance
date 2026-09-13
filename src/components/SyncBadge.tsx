import { Component } from 'solid-js';
import { syncStatus, triggerSync, getActiveProvider, pendingCount } from '../services/sync/syncManager';
import { loadExpensesForSelectedMonth } from '../stores/expenseStore';

export const SyncBadge: Component = () => {
  const handleClick = async () => {
    await triggerSync(true);
    await loadExpensesForSelectedMonth();
  };

  // Hanya berwarna BIRU jika akun cloud terhubung dan seluruh transaksi sukses tersinkron
  const isConfigured = () => {
    const provider = getActiveProvider();
    return !!(provider && provider.isConfigured());
  };

  const isCloudSynced = () => {
    if (!isConfigured()) return false;
    return syncStatus() === 'synced' && pendingCount() === 0;
  };

  return (
    <button
      onClick={handleClick}
      type="button"
      class="w-7 h-7 rounded-full border border-warm-border bg-warm-card hover:bg-warm-subtle transition-all active:scale-95 shadow-sm flex items-center justify-center"
      title={
        isCloudSynced()
          ? 'Tersinkron ke Google Sheets'
          : !isConfigured()
          ? 'Mode offline (input sinkronisasi belum diisi)'
          : 'Belum tersinkron (klik untuk sinkronkan)'
      }
    >
      <span
        class={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
          isCloudSynced()
            ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]'
            : 'bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.5)]'
        }`}
      />
    </button>
  );
};

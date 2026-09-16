import { createSignal } from 'solid-js';
import { db } from '../db';
import { isOnline, onNetworkChange } from '../network';
import { settings, setLastSyncTimestamp } from '../../stores/settingsStore';
import { loadExpensesForSelectedMonth } from '../../stores/expenseStore';
import { appsScriptSyncProvider } from './appsScriptSync';
import { serviceAccountSyncProvider } from './serviceAccountSync';
import { SyncProvider } from './types';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

const [syncStatus, setSyncStatus] = createSignal<SyncState>('offline');
const [syncMessage, setSyncMessage] = createSignal<string>('');
const [pendingCount, setPendingCount] = createSignal<number>(0);

export async function refreshPendingCount(): Promise<number> {
  const pending = await db.getPendingExpenses();
  const count = pending.length;
  setPendingCount(count);

  const provider = getActiveProvider();
  if (!provider || !provider.isConfigured() || !isOnline()) {
    setSyncStatus('offline');
  } else if (count > 0 && syncStatus() !== 'syncing') {
    setSyncStatus('pending');
  } else if (count === 0 && syncStatus() !== 'syncing' && syncStatus() !== 'error') {
    setSyncStatus('synced');
  }

  return count;
}

export function getActiveProvider(): SyncProvider | null {
  const mode = settings().syncMode;
  if (mode === 'apps_script') return appsScriptSyncProvider;
  if (mode === 'service_account') return serviceAccountSyncProvider;
  return null;
}

/**
 * Memicu sinkronisasi dua arah secara otomatis atau manual
 */
export async function triggerSync(force = false): Promise<{ success: boolean; message: string }> {
  const provider = getActiveProvider();
  if (!provider || !provider.isConfigured()) {
    setSyncStatus('offline');
    return { success: false, message: 'Input sinkronisasi belum diisi (mode offline aktif).' };
  }

  if (!isOnline() && !force) {
    setSyncStatus('offline');
    return { success: false, message: 'Tidak ada koneksi internet (mode offline).' };
  }

  try {
    setSyncStatus('syncing');
    setSyncMessage('Sedang menyinkronkan data...');

    const pendingItems = await db.getPendingExpenses();
    const lastSyncTime = force ? 0 : settings().lastSyncTimestamp;

    // 1. Eksekusi sync ke provider
    const result = await provider.sync(pendingItems, lastSyncTime);

    if (!result.success) {
      setSyncStatus('error');
      setSyncMessage(result.error || 'Sinkronisasi gagal.');
      return { success: false, message: result.error || 'Gagal.' };
    }

    // 2. Gabungkan data baru dari server ke IndexedDB lokal dan perbarui tampilan
    if (result.serverChanges && result.serverChanges.length > 0) {
      await db.mergeServerChanges(result.serverChanges);
      await loadExpensesForSelectedMonth();
    }

    // 3. Tandai data lokal yang berhasil dikirim menjadi 'synced'
    if (pendingItems.length > 0) {
      await db.markAsSynced(pendingItems.map((item) => item.id));
    }

    // 4. Perbarui timestamp sinkronisasi
    const newServerTime = result.serverTimestamp || Date.now();
    await setLastSyncTimestamp(newServerTime);

    await refreshPendingCount();
    setSyncStatus('synced');
    setSyncMessage('Semua data berhasil disinkronkan.');

    return { success: true, message: 'Sinkronisasi sukses.' };
  } catch (error: any) {
    setSyncStatus('error');
    setSyncMessage(error.message || 'Kesalahan sinkronisasi.');
    return { success: false, message: error.message };
  }
}

/**
 * Inisialisasi auto-sync: berkala, saat online, dan saat aplikasi dibuka kembali
 */
export function initSyncManager(): void {
  // 1. Listener saat kembali online dari offline
  onNetworkChange((online) => {
    const provider = getActiveProvider();
    if (online && provider && provider.isConfigured()) {
      triggerSync();
    } else {
      setSyncStatus('offline');
    }
  });

  // 2. Auto-sync saat aplikasi dibuka kembali dari background (misal setelah buka WA)
  document.addEventListener('visibilitychange', () => {
    const provider = getActiveProvider();
    if (document.visibilityState === 'visible' && isOnline() && provider && provider.isConfigured()) {
      triggerSync();
    }
  });

  window.addEventListener('focus', () => {
    const provider = getActiveProvider();
    if (isOnline() && provider && provider.isConfigured()) {
      triggerSync();
    }
  });

  // 3. Auto-sync berkala setiap 15 detik selama layar aplikasi aktif
  setInterval(() => {
    const provider = getActiveProvider();
    if (
      document.visibilityState === 'visible' &&
      isOnline() &&
      provider &&
      provider.isConfigured() &&
      syncStatus() !== 'syncing'
    ) {
      triggerSync();
    }
  }, 15000);

  // 4. Refresh pending count awal
  refreshPendingCount();

  // 5. Jika online saat app pertama kali dibuka dan provider sudah dikonfigurasi, trigger sync awal
  const provider = getActiveProvider();
  if (isOnline() && provider && provider.isConfigured()) {
    setTimeout(() => {
      triggerSync();
    }, 800);
  }
}

export { syncStatus, syncMessage, pendingCount };

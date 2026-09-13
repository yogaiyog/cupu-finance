import { createSignal } from 'solid-js';
import { Preferences } from '@capacitor/preferences';
import { AppSettings, SyncMode } from '../types';

const SETTINGS_KEY = 'cupu_app_settings';

const defaultSettings: AppSettings = {
  syncMode: 'service_account',
  lastSyncTimestamp: 0,
  currency: 'Rp',
};

const [settings, setSettingsState] = createSignal<AppSettings>(defaultSettings);
const [isLoadingSettings, setIsLoadingSettings] = createSignal<boolean>(true);

export async function initSettings(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (value) {
      const parsed = JSON.parse(value) as AppSettings;
      if (!parsed.syncMode || (parsed.syncMode as any) === 'offline') {
        parsed.syncMode = 'service_account';
      }
      setSettingsState(parsed);
    } else {
      setSettingsState(defaultSettings);
    }
  } catch (error) {
    console.error('Gagal memuat pengaturan:', error);
    setSettingsState(defaultSettings);
  } finally {
    setIsLoadingSettings(false);
  }
}

export async function updateSettings(newPartial: Partial<AppSettings>): Promise<void> {
  const updated: AppSettings = { ...settings(), ...newPartial };
  setSettingsState(updated);
  await Preferences.set({
    key: SETTINGS_KEY,
    value: JSON.stringify(updated),
  });
}

export async function setSyncMode(mode: SyncMode): Promise<void> {
  await updateSettings({ syncMode: mode });
}

export async function setScriptUrl(url: string): Promise<void> {
  await updateSettings({ scriptUrl: url.trim() });
}

export async function setServiceAccountConfig(jsonString: string, spreadsheetId?: string): Promise<{ success: boolean; error?: string; email?: string }> {
  try {
    const trimmed = jsonString.trim();
    if (!trimmed) {
      await updateSettings({
        serviceAccountJson: '',
        serviceAccountEmail: '',
      });
      return { success: true };
    }

    const parsed = JSON.parse(trimmed);
    if (!parsed.client_email || !parsed.private_key) {
      return {
        success: false,
        error: 'JSON tidak valid: harus memiliki "client_email" dan "private_key".',
      };
    }

    await updateSettings({
      serviceAccountJson: trimmed,
      serviceAccountEmail: parsed.client_email,
      spreadsheetId: spreadsheetId?.trim() || settings().spreadsheetId,
      syncMode: 'service_account',
    });

    return { success: true, email: parsed.client_email };
  } catch (err: any) {
    return { success: false, error: 'Format JSON salah: ' + err.message };
  }
}

export async function setSpreadsheetId(idOrUrl: string): Promise<void> {
  // Ekstrak ID jika user memasukkan link lengkap docs.google.com/spreadsheets/d/{ID}/edit
  let cleanId = idOrUrl.trim();
  const match = cleanId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    cleanId = match[1];
  }
  await updateSettings({ spreadsheetId: cleanId });
}

export async function setLastSyncTimestamp(timestamp: number): Promise<void> {
  await updateSettings({ lastSyncTimestamp: timestamp });
}

export async function setHasSeenOnboarding(seen: boolean): Promise<void> {
  await updateSettings({ hasSeenOnboarding: seen });
}

export async function setUserName(name: string): Promise<void> {
  await updateSettings({ userName: name.trim() });
}

export async function setMonthlyIncome(income: number): Promise<void> {
  await updateSettings({ monthlyIncome: income });
}

export async function setCurrentBalance(balance: number): Promise<void> {
  await updateSettings({ currentBalance: balance });
}

export async function setDailyBudget(budget: number): Promise<void> {
  await updateSettings({ dailyBudget: budget });
}

export async function setInitialBalance(balance: number, month?: string): Promise<void> {
  await updateSettings({
    initialBalance: balance,
    initialBalanceMonth: month || '',
  });
}

export { settings, isLoadingSettings };

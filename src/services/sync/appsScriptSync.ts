import { Expense } from '../../types';
import { settings } from '../../stores/settingsStore';
import { SyncProvider, SyncResult } from './types';

export class AppsScriptSyncProvider implements SyncProvider {
  name = 'Google Apps Script Webhook';

  isConfigured(): boolean {
    const url = settings().scriptUrl;
    return !!url && url.startsWith('https://script.google.com/');
  }

  async sync(pendingChanges: Expense[], lastSyncTimestamp: number): Promise<SyncResult> {
    const url = settings().scriptUrl;
    if (!url) {
      return { success: false, error: 'URL Google Apps Script belum diisi.' };
    }

    try {
      const payload = {
        lastSyncTimestamp,
        changes: pendingChanges,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Apps Script handles text/plain payload without CORS preflight block
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`Server merespons status ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Terjadi kesalahan saat memproses data di Google Sheet.');
      }

      return {
        success: true,
        serverTimestamp: result.serverTimestamp || Date.now(),
        serverChanges: result.serverChanges || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Gagal menghubungi server Apps Script.',
      };
    }
  }

  /**
   * Tes koneksi cepat ke Web App
   */
  async testConnection(targetUrl?: string): Promise<{ success: boolean; message: string }> {
    const url = targetUrl || settings().scriptUrl;
    if (!url) {
      return { success: false, message: 'URL Apps Script belum diisi.' };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ lastSyncTimestamp: 0, changes: [] }),
        redirect: 'follow',
      });

      const data = await res.json();
      if (data && data.success) {
        return { success: true, message: 'Koneksi ke Google Sheet berhasil!' };
      }
      return { success: false, message: data.error || 'Respons tidak valid dari server.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Gagal tersambung ke URL.' };
    }
  }
}

export const appsScriptSyncProvider = new AppsScriptSyncProvider();

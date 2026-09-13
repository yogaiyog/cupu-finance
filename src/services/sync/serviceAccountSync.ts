import { Expense } from '../../types';
import { settings } from '../../stores/settingsStore';
import { SyncProvider, SyncResult } from './types';

function pemToBinary(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

export class ServiceAccountSyncProvider implements SyncProvider {
  name = 'Google Sheets (Service Account)';
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  isConfigured(): boolean {
    const s = settings();
    return !!(s.serviceAccountJson && s.spreadsheetId);
  }

  /**
   * Buat JWT assertion ditandatangani Web Crypto (RS256) lalu tukar dengan Google OAuth2 access token
   */
  async getAccessToken(customJson?: string): Promise<string> {
    const jsonStr = customJson || settings().serviceAccountJson;
    if (!jsonStr) {
      throw new Error('Kredensial Service Account JSON belum diatur.');
    }

    // Jika token masih berlaku lebih dari 2 menit ke depan, gunakan cache
    if (!customJson && this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 120000) {
      return this.cachedAccessToken;
    }

    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(jsonStr);
    } catch {
      throw new Error('Format JSON Service Account tidak valid.');
    }

    if (!sa.client_email || !sa.private_key) {
      throw new Error('JSON harus memiliki properti "client_email" dan "private_key".');
    }

    // Import private key PKCS#8 via Web Crypto API
    const keyDer = pemToBinary(sa.private_key);
    const cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      keyDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    );

    const unsignedToken = `${header}.${payload}`;
    const signatureBuffer = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );
    const jwt = `${unsignedToken}.${bufferToBase64Url(signatureBuffer)}`;

    // Exchange JWT assertion dengan Google access token
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error_description || err.error || 'Gagal otentikasi Service Account ke Google.');
    }

    const data = await res.json();
    if (!customJson) {
      this.cachedAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    }

    return data.access_token;
  }

  /**
   * Ekstrak Spreadsheet ID dari link atau string ID murni
   */
  extractSpreadsheetId(idOrUrl: string): string {
    const clean = idOrUrl.trim();
    const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return clean;
  }

  /**
   * Tes koneksi ke Google Sheets
   */
  async testConnection(
    customJson?: string,
    customSheetId?: string
  ): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const spreadsheetId = this.extractSpreadsheetId(customSheetId || settings().spreadsheetId || '');
      if (!spreadsheetId) {
        return {
          success: false,
          message: 'Harap masukkan ID atau Link Google Sheet Anda.',
        };
      }

      const token = await this.getAccessToken(customJson);

      // Cek metadata spreadsheet
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!metaRes.ok) {
        if (metaRes.status === 404) {
          return {
            success: false,
            message: 'Spreadsheet tidak ditemukan. Pastikan Link / ID Google Sheet sudah benar.',
          };
        }
        if (metaRes.status === 403) {
          return {
            success: false,
            message:
              'Akses ditolak (403). Pastikan Anda sudah klik "Bagikan (Share)" di Google Sheet tersebut dan jadikan email Service Account sebagai Editor!',
          };
        }
        const err = await metaRes.json().catch(() => ({}));
        return {
          success: false,
          message: err.error?.message || `Gagal mengakses Google Sheet (Kode HTTP ${metaRes.status}).`,
        };
      }

      const metaData = await metaRes.json();
      const sheets = metaData.sheets || [];
      const hasExpensesTab = sheets.some((s: any) => s.properties?.title === 'Expenses');

      // Jika belum ada tab Expenses, buat atau format header
      await this.ensureExpensesSheet(token, spreadsheetId, hasExpensesTab);

      return {
        success: true,
        message: 'Koneksi Berhasil! Google Sheet siap digunakan untuk sinkronisasi otomatis.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Gagal menghubungkan Service Account.',
      };
    }
  }

  /**
   * Pastikan tab 'Expenses' dan header baris pertama tersedia
   */
  private async ensureExpensesSheet(token: string, spreadsheetId: string, hasExpensesTab: boolean): Promise<void> {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Buat tab 'Expenses' jika belum ada
    if (!hasExpensesTab) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Expenses',
                },
              },
            },
          ],
        }),
      });
    }

    // Cek apakah header di baris 1 sudah ada
    const checkHeaderRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A1:G1`,
      { headers: authHeaders }
    );

    const headerData = await checkHeaderRes.json().catch(() => ({}));
    if (!headerData.values || headerData.values.length === 0 || !headerData.values[0][0]) {
      // Tulis baris header
      const headers = ['id', 'date', 'amount', 'category', 'note', 'updated_at', 'is_deleted'];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A1:G1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }
  }

  /**
   * Sinkronisasi dua arah via Google Sheets REST API v4
   */
  async sync(pendingChanges: Expense[], lastSyncTimestamp: number): Promise<SyncResult> {
    const spreadsheetId = this.extractSpreadsheetId(settings().spreadsheetId || '');
    if (!spreadsheetId) {
      return { success: false, error: 'Google Sheet ID belum diatur.' };
    }

    try {
      const token = await this.getAccessToken();
      const authHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A:G`;
      const readRes = await fetch(readUrl, { headers: authHeaders });

      if (readRes.status === 403) {
        return {
          success: false,
          error: 'Akses Google Sheet ditolak. Pastikan email Service Account sudah ditambahkan sebagai Editor.',
        };
      }

      let existingRows: any[][] = [];
      if (readRes.ok) {
        const readData = await readRes.json();
        existingRows = readData.values || [];
      } else {
        // Coba inisialisasi sheet jika belum ada
        await this.ensureExpensesSheet(token, spreadsheetId, false);
      }

      // Map ID ke nomor baris (baris 1 adalah header)
      const idRowMap = new Map<string, { rowNum: number; updatedAt: number }>();
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i];
        if (row && row[0]) {
          idRowMap.set(String(row[0]), {
            rowNum: i + 1,
            updatedAt: Number(row[5]) || 0,
          });
        }
      }

      // 1. Tulis perubahan pending dari HP ke Sheet
      for (const item of pendingChanges) {
        const rowData = [
          item.id,
          item.date,
          item.amount,
          item.category,
          item.note || '',
          item.updated_at,
          item.is_deleted ? 'TRUE' : 'FALSE',
        ];

        const existing = idRowMap.get(item.id);
        if (existing) {
          if (item.updated_at >= existing.updatedAt) {
            const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A${existing.rowNum}:G${existing.rowNum}?valueInputOption=USER_ENTERED`;
            await fetch(updateUrl, {
              method: 'PUT',
              headers: authHeaders,
              body: JSON.stringify({ values: [rowData] }),
            });
          }
        } else {
          const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Expenses!A:G:append?valueInputOption=USER_ENTERED`;
          await fetch(appendUrl, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ values: [rowData] }),
          });
        }
      }

      // 2. Baca kembali untuk mendeteksi perubahan dari server/Google Sheet
      const reReadRes = await fetch(readUrl, { headers: authHeaders });
      const reReadData = await reReadRes.json();
      const updatedRows: any[][] = reReadData.values || [];
      const serverChanges: Expense[] = [];

      for (let i = 1; i < updatedRows.length; i++) {
        const row = updatedRows[i];
        if (!row || !row[0]) continue;
        const rowUpdatedAt = Number(row[5]) || 0;

        if (rowUpdatedAt > lastSyncTimestamp) {
          serverChanges.push({
            id: String(row[0]),
            date: String(row[1]),
            amount: Number(row[2]) || 0,
            category: (row[3] || 'Lainnya') as any,
            note: String(row[4] || ''),
            updated_at: rowUpdatedAt,
            is_deleted: String(row[6]).toUpperCase() === 'TRUE',
            sync_status: 'synced',
          });
        }
      }

      return {
        success: true,
        serverTimestamp: Date.now(),
        serverChanges,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal sinkronisasi dengan Google Sheets via Service Account.',
      };
    }
  }
}

export const serviceAccountSyncProvider = new ServiceAccountSyncProvider();

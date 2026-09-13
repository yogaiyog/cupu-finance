import { Expense } from '../../types';
import { settings } from '../../stores/settingsStore';
import { SyncProvider, SyncResult } from './types';
import { db } from '../db';

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
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties,sheets.charts`,
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

      // Ambil daftar kategori dari database (bawaan + custom)
      const defaultNames = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Lainnya'];
      const catNames = [...defaultNames];
      try {
        const allCats = await db.getAllCategories();
        for (const c of allCats) {
          if (!catNames.includes(c.name)) {
            catNames.push(c.name);
          }
        }
      } catch {
        // fallback
      }

      // Pastikan tab Expenses dan Statistik tersedia
      await this.ensureExpensesSheet(token, spreadsheetId, sheets, catNames);
      try {
        await this.ensureStatisticsSheet(token, spreadsheetId, sheets, catNames);
      } catch (err) {
        console.warn('Gagal menyiapkan sheet statistik:', err);
      }

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
   * Pastikan tab 'Expenses' dan header baris pertama tersedia serta diformat
   */
  private async ensureExpensesSheet(
    token: string,
    spreadsheetId: string,
    sheets: any[],
    catNames: string[]
  ): Promise<void> {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let expensesSheet = sheets.find((s: any) => s.properties?.title === 'Expenses');
    let expensesSheetId: number | undefined = expensesSheet?.properties?.sheetId;

    // Buat tab 'Expenses' jika belum ada
    if (!expensesSheet) {
      const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
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
      if (addRes.ok) {
        const addData = await addRes.json();
        expensesSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
      }
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

    // Format header Expenses + Dropdown Kategori + Freeze Baris 1
    if (expensesSheetId !== undefined) {
      const expensesFormatRequests: any[] = [
        // Style Header baris 1: background warmsoft, teks tebal
        {
          repeatCell: {
            range: {
              sheetId: expensesSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.91, green: 0.89, blue: 0.87 },
                textFormat: { bold: true, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        // Freeze baris 1 agar header tetap terlihat saat scroll
        {
          updateSheetProperties: {
            properties: {
              sheetId: expensesSheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Format kolom amount (C) sebagai Rupiah
        {
          repeatCell: {
            range: {
              sheetId: expensesSheetId,
              startRowIndex: 1,
              endRowIndex: 2000,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '"Rp "#,##0' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
        // Dropdown data validation pada kolom Kategori (D)
        {
          setDataValidation: {
            range: {
              sheetId: expensesSheetId,
              startRowIndex: 1,
              endRowIndex: 2000,
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: catNames.map((name) => ({ userEnteredValue: name })),
              },
              inputMessage: 'Pilih kategori pengeluaran',
              strict: false,
              showCustomUi: true,
            },
          },
        },
        // Lebar kolom rapi
        {
          updateDimensionProperties: {
            range: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 100 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 110 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
            properties: { pixelSize: 130 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
            properties: { pixelSize: 140 },
            fields: 'pixelSize',
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: expensesSheetId, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
            properties: { pixelSize: 220 },
            fields: 'pixelSize',
          },
        },
      ];

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ requests: expensesFormatRequests }),
      }).catch((e) => console.warn('Gagal memformat sheet Expenses:', e));
    }
  }

  /**
   * Pastikan tab 'Statistik' dan chart visual tersedia
   */
  private async ensureStatisticsSheet(
    token: string,
    spreadsheetId: string,
    sheets: any[],
    catNames: string[]
  ): Promise<void> {
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let statSheet = sheets.find((s: any) => s.properties?.title === 'Statistik');
    let statSheetId: number | undefined = statSheet?.properties?.sheetId;

    const endRow = 11 + catNames.length;

    // 1. Buat sheet 'Statistik' di index 0 jika belum ada
    if (!statSheet) {
      const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Statistik',
                  index: 0,
                  gridProperties: {
                    rowCount: Math.max(50, endRow + 10),
                    columnCount: 15,
                  },
                },
              },
            },
          ],
        }),
      });

      if (!addRes.ok) {
        console.warn('Gagal menambahkan tab Statistik:', await addRes.text());
        return;
      }

      const addData = await addRes.json();
      statSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
    }

    if (statSheetId === undefined) return;

    // 2. Cek apakah formula sudah terisi di tab Statistik
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Statistik!A1:B5`,
      { headers: authHeaders }
    );
    const checkData = await checkRes.json().catch(() => ({}));
    const needsValues = !checkData.values || checkData.values.length === 0 || !checkData.values[0]?.[0];

    if (needsValues) {
      // Siapkan data baris formula dengan Filter Rentang Tanggal di bagian atas
      const rows: string[][] = [
        ['📊 RINGKASAN & STATISTIK KEUANGAN', '', '', ''],
        [
          'Periode Mulai:',
          '=IFERROR(MIN(Expenses!B2:B), TEXT(TODAY(), "yyyy-mm-01"))',
          'Periode Selesai:',
          '=TEXT(TODAY(), "yyyy-mm-dd")',
        ],
        ['', '', '', ''],
        ['Indikator', 'Nilai (Sesuai Periode)', '', ''],
        [
          'Total Pengeluaran',
          '=SUMIFS(Expenses!C2:C, Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!G2:G, "<>TRUE")',
          '',
          '',
        ],
        [
          'Pengeluaran Bulan Berjalan',
          '=SUMIFS(Expenses!C2:C, Expenses!B2:B, ">=" & TEXT(TODAY(), "yyyy-mm-01"), Expenses!B2:B, "<=" & TEXT(EOMONTH(TODAY(), 0), "yyyy-mm-dd"), Expenses!G2:G, "<>TRUE")',
          '',
          '',
        ],
        [
          'Rata-rata Harian',
          '=IFERROR(B5 / MAX(1, COUNTUNIQUEIFS(Expenses!B2:B, Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")), 0)',
          '',
          '',
        ],
        [
          'Jumlah Transaksi',
          '=COUNTIFS(Expenses!B2:B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!B2:B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!C2:C, ">0", Expenses!G2:G, "<>TRUE")',
          '',
          '',
        ],
        [
          'Kategori Paling Boros',
          `=IF(MAX(B12:B${endRow})>0, INDEX(A12:A${endRow}, MATCH(MAX(B12:B${endRow}), B12:B${endRow}, 0)), "-")`,
          '',
          '',
        ],
        ['', '', '', ''],
        ['Kategori', 'Total Pengeluaran', 'Porsi (%)', ''],
      ];

      for (let i = 0; i < catNames.length; i++) {
        const r = 12 + i;
        rows.push([
          catNames[i],
          `=SUMIFS(Expenses!$C$2:$C, Expenses!$D$2:$D, A${r}, Expenses!$B$2:$B, ">=" & IF(ISBLANK($B$2), "1970-01-01", TEXT($B$2, "yyyy-mm-dd")), Expenses!$B$2:$B, "<=" & IF(ISBLANK($D$2), "2099-12-31", TEXT($D$2, "yyyy-mm-dd")), Expenses!$G$2:$G, "<>TRUE")`,
          `=IFERROR(B${r} / $B$5, 0)`,
          '',
        ]);
      }

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Statistik!A1:D${endRow}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ values: rows }),
        }
      );
    }

    // 3. Cek apakah chart sudah ada
    const hasChart = statSheet?.charts && statSheet.charts.length > 0;

    // Format tampilan sel & chart visual
    const formatRequests: any[] = [
      // Banner Judul A1
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 4,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
            },
          },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      // Range Date Labels (Baris 2, Kolom A & C)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.93, blue: 0.91 },
              textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 1,
            endRowIndex: 2,
            startColumnIndex: 2,
            endColumnIndex: 3,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.93, blue: 0.91 },
              textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      // Header KPI (Baris 4, 0-indexed 3)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 3,
            endRowIndex: 4,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.91, green: 0.89, blue: 0.87 },
              textFormat: { bold: true, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      // Header Kategori (Baris 11, 0-indexed 10)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 10,
            endRowIndex: 11,
            startColumnIndex: 0,
            endColumnIndex: 3,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.91, green: 0.89, blue: 0.87 },
              textFormat: { bold: true, foregroundColor: { red: 0.18, green: 0.16, blue: 0.15 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      // Format Mata Uang B5:B7 (0-indexed 4 to 7)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 4,
            endRowIndex: 7,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '"Rp "#,##0' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
      // Format Jumlah Transaksi B8 (0-indexed 7 to 8)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 7,
            endRowIndex: 8,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'NUMBER', pattern: '#,##0' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
      // Format Mata Uang Total Kategori B12:BendRow (0-indexed 11 to endRow)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 11,
            endRowIndex: endRow,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'CURRENCY', pattern: '"Rp "#,##0' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
      // Format Persentase C12:CendRow (0-indexed 11 to endRow)
      {
        repeatCell: {
          range: {
            sheetId: statSheetId,
            startRowIndex: 11,
            endRowIndex: endRow,
            startColumnIndex: 2,
            endColumnIndex: 3,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: 'PERCENT', pattern: '0.0%' },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
      // Lebar Kolom A, B, C, D
      {
        updateDimensionProperties: {
          range: { sheetId: statSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 210 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: statSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 170 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: statSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 130 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: statSheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 140 },
          fields: 'pixelSize',
        },
      },
    ];

    // Tambahkan Donut Chart jika belum ada
    if (!hasChart) {
      formatRequests.push({
        addChart: {
          chart: {
            spec: {
              title: 'Proporsi Pengeluaran per Kategori',
              pieChart: {
                legendPosition: 'RIGHT_LEGEND',
                domain: {
                  sourceRange: {
                    sources: [
                      {
                        sheetId: statSheetId,
                        startRowIndex: 11,
                        endRowIndex: endRow,
                        startColumnIndex: 0,
                        endColumnIndex: 1,
                      },
                    ],
                  },
                },
                series: {
                  sourceRange: {
                    sources: [
                      {
                        sheetId: statSheetId,
                        startRowIndex: 11,
                        endRowIndex: endRow,
                        startColumnIndex: 1,
                        endColumnIndex: 2,
                      },
                    ],
                  },
                },
                pieHole: 0.4,
              },
            },
            position: {
              overlayPosition: {
                anchorCell: {
                  sheetId: statSheetId,
                  rowIndex: 3,
                  columnIndex: 4,
                },
                offsetXPixels: 15,
                offsetYPixels: 0,
                widthPixels: 520,
                heightPixels: 350,
              },
            },
          },
        },
      });
    }

    if (needsValues || !hasChart) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ requests: formatRequests }),
      });
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

      const defaultNames = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Lainnya'];
      const catNames = [...defaultNames];
      try {
        const allCats = await db.getAllCategories();
        for (const c of allCats) {
          if (!catNames.includes(c.name)) {
            catNames.push(c.name);
          }
        }
      } catch {}

      // Pastikan tab Expenses dan Statistik tersedia
      try {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties,sheets.charts`,
          { headers: authHeaders }
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const sheets = metaData.sheets || [];
          await this.ensureExpensesSheet(token, spreadsheetId, sheets, catNames);
          await this.ensureStatisticsSheet(token, spreadsheetId, sheets, catNames);
        }
      } catch (err) {
        console.warn('Gagal memeriksa/menyiapkan sheet statistik saat sync:', err);
      }

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
        await this.ensureExpensesSheet(token, spreadsheetId, [], catNames);
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

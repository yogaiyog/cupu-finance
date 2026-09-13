export interface Category {
  id: string;
  name: string;
  color: string;
  softColor: string;
  icon: string;
  isDefault?: boolean;
  order?: number;
}

export type ExpenseCategory = string;

export interface Expense {
  id: string;              // UUID v4
  date: string;            // Format YYYY-MM-DD
  amount: number;          // Nominal (e.g. 25000)
  category: ExpenseCategory;
  note?: string;           // Catatan singkat
  updated_at: number;      // Epoch timestamp in ms
  is_deleted: boolean;     // Soft delete flag
  sync_status: 'synced' | 'pending';
}

export type SyncMode = 'service_account' | 'apps_script' | 'offline';

export interface ServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
}

export interface AppSettings {
  syncMode: SyncMode;
  serviceAccountJson?: string; // Teks JSON kredensial Service Account
  serviceAccountEmail?: string; // Email robot terurai (untuk panduan share sheet)
  spreadsheetId?: string;      // ID atau URL Google Sheet target
  scriptUrl?: string;          // Google Apps Script Web App URL
  lastSyncTimestamp: number;   // Epoch timestamp in ms
  currency: string;            // Default 'Rp'
  hasSeenOnboarding?: boolean; // Status apakah user sudah melewati welcome screen
  userName?: string;           // Nama panggilan user (opsional)
  monthlyIncome?: number;      // Penghasilan bulanan user
  currentBalance?: number;     // Sisa uang saat ini sampai akhir bulan
  dailyBudget?: number;        // Budget batas harian rekomendasi
  initialBalance?: number;     // Sisa uang saat onboard
  initialBalanceMonth?: string;// Bulan saat onboard (YYYY-MM)
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  percentage: number;
  color: string;
  softColor: string;
}

export interface MonthlySummary {
  yearMonth: string;           // YYYY-MM
  totalAmount: number;
  dailyAverage: number;
  daysInMonth: number;
  categories: CategorySummary[];
}

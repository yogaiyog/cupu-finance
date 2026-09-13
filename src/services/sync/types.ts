import { Expense } from '../../types';

export interface SyncResult {
  success: boolean;
  serverTimestamp?: number;
  serverChanges?: Expense[];
  error?: string;
}

export interface SyncProvider {
  name: string;
  isConfigured(): boolean;
  sync(pendingChanges: Expense[], lastSyncTimestamp: number): Promise<SyncResult>;
}

import { collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { logActivity } from './activityLogger';

export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastBackupDate: string | null;
  autoDownload: boolean;
}

export interface BackupDataPayload {
  version: string;
  appName: string;
  timestamp: string;
  data: {
    products: any[];
    sales: any[];
    categories: any[];
    users: any[];
    taxSettings: any[];
    activityLogs: any[];
  };
}

const STORAGE_KEY = 'maf_auto_backup_config';
const SNAPSHOT_KEY = 'maf_latest_backup_snapshot';

export const DEFAULT_BACKUP_CONFIG: AutoBackupConfig = {
  enabled: true,
  frequency: 'daily',
  lastBackupDate: null,
  autoDownload: false,
};

export const getAutoBackupConfig = (): AutoBackupConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error reading auto backup config:', error);
  }
  return DEFAULT_BACKUP_CONFIG;
};

export const saveAutoBackupConfig = (config: AutoBackupConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving auto backup config:', error);
  }
};

/**
 * Creates a full data export of all core Firestore collections.
 */
export const createFullBackup = async (triggerDownload = true): Promise<BackupDataPayload> => {
  const collectionsToFetch = ['products', 'sales', 'categories', 'users', 'taxSettings', 'activityLogs'];
  const fetchedData: Record<string, any[]> = {};

  for (const colName of collectionsToFetch) {
    try {
      const snap = await getDocs(collection(db, colName));
      fetchedData[colName] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
    } catch (err) {
      console.warn(`Could not backup collection ${colName}:`, err);
      fetchedData[colName] = [];
    }
  }

  const payload: BackupDataPayload = {
    version: '1.0.0',
    appName: 'MAF Computers Management System',
    timestamp: new Date().toISOString(),
    data: {
      products: fetchedData['products'] || [],
      sales: fetchedData['sales'] || [],
      categories: fetchedData['categories'] || [],
      users: fetchedData['users'] || [],
      taxSettings: fetchedData['taxSettings'] || [],
      activityLogs: fetchedData['activityLogs'] || [],
    },
  };

  // Cache latest snapshot in localStorage for quick recovery
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('LocalStorage full, skipped snapshot storage');
  }

  if (triggerDownload) {
    downloadBackupFile(payload);
  }

  logActivity('SYSTEM_BACKUP', `Full backup generated with ${payload.data.products.length} products & ${payload.data.sales.length} sales records`);

  return payload;
};

/**
 * Downloads backup payload as a .json file.
 */
export const downloadBackupFile = (payload: BackupDataPayload) => {
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `MAF_Computers_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Checks if auto-backup is due according to the user's frequency setting.
 */
export const checkAndTriggerAutoBackup = async (): Promise<{ executed: boolean; timestamp?: string }> => {
  const config = getAutoBackupConfig();
  if (!config.enabled) return { executed: false };

  const now = new Date();
  let isDue = false;

  if (!config.lastBackupDate) {
    isDue = true;
  } else {
    const lastBackup = new Date(config.lastBackupDate);
    const diffMs = now.getTime() - lastBackup.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (config.frequency === 'daily' && diffHours >= 24) {
      isDue = true;
    } else if (config.frequency === 'weekly' && diffHours >= 24 * 7) {
      isDue = true;
    } else if (config.frequency === 'monthly' && diffHours >= 24 * 30) {
      isDue = true;
    }
  }

  if (isDue) {
    try {
      const payload = await createFullBackup(config.autoDownload);
      const updatedConfig: AutoBackupConfig = {
        ...config,
        lastBackupDate: payload.timestamp,
      };
      saveAutoBackupConfig(updatedConfig);
      return { executed: true, timestamp: payload.timestamp };
    } catch (err) {
      console.error('Auto Backup failed:', err);
    }
  }

  return { executed: false };
};

/**
 * Restores data from a parsed backup JSON file into Firestore.
 */
export const restoreBackupData = async (payload: BackupDataPayload): Promise<{ restoredCount: number; details: string }> => {
  if (!payload || !payload.data) {
    throw new Error('Invalid backup file format.');
  }

  const { products = [], categories = [], taxSettings = [] } = payload.data;
  let restoredCount = 0;

  // Restore Products
  for (const item of products) {
    if (item.id) {
      const docRef = doc(db, 'products', item.id);
      const { id, ...dataToSave } = item;
      await setDoc(docRef, dataToSave, { merge: true });
      restoredCount++;
    }
  }

  // Restore Categories
  for (const cat of categories) {
    if (cat.id) {
      const docRef = doc(db, 'categories', cat.id);
      const { id, ...dataToSave } = cat;
      await setDoc(docRef, dataToSave, { merge: true });
      restoredCount++;
    }
  }

  // Restore Tax Settings
  for (const tax of taxSettings) {
    if (tax.id) {
      const docRef = doc(db, 'taxSettings', tax.id);
      const { id, ...dataToSave } = tax;
      await setDoc(docRef, dataToSave, { merge: true });
      restoredCount++;
    }
  }

  logActivity('SYSTEM_RESTORE', `Restored ${restoredCount} database records from backup file generated on ${payload.timestamp}`);

  return {
    restoredCount,
    details: `Restored ${products.length} products and ${categories.length} categories successfully.`,
  };
};

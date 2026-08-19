import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number; // default 15
  incomeTaxRate: number; // default 35
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  vatEnabled: true,
  vatRate: 15,
  incomeTaxRate: 35,
};

export const getTaxSettings = async (): Promise<TaxSettings> => {
  try {
    const docRef = doc(db, 'settings', 'vat');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const settings: TaxSettings = {
        vatEnabled: data.enabled ?? true,
        vatRate: data.rate ?? 15,
        incomeTaxRate: data.incomeTaxRate ?? 35,
      };
      localStorage.setItem('taxSettings', JSON.stringify(settings));
      return settings;
    }
  } catch (error) {
    console.error('Error fetching tax settings from Firestore:', error);
  }

  // Fallback to localStorage or default
  const cached = localStorage.getItem('taxSettings');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error('Failed to parse cached taxSettings:', e);
    }
  }

  return DEFAULT_TAX_SETTINGS;
};

export const saveTaxSettings = async (settings: TaxSettings): Promise<void> => {
  try {
    localStorage.setItem('taxSettings', JSON.stringify(settings));
    const docRef = doc(db, 'settings', 'vat');
    await setDoc(docRef, {
      enabled: settings.vatEnabled,
      rate: settings.vatRate,
      incomeTaxRate: settings.incomeTaxRate,
      updatedAt: new Date(),
    });
    window.dispatchEvent(new CustomEvent('taxSettingsChanged', { detail: settings }));
  } catch (error) {
    console.error('Error saving tax settings to Firestore:', error);
  }
};

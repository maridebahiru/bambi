
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Receipt, Percent, Globe } from 'lucide-react';
import { getTaxSettings, saveTaxSettings, TaxSettings } from '../lib/taxSettings';
import CategoryManager from '../components/CategoryManager';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [currency, setCurrency] = useState('Br');
  const { language, setLanguage, t } = useLanguage();
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });
  const [savingTax, setSavingTax] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load saved settings from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const savedCurrency = localStorage.getItem('currency') || 'Br';
    
    setDarkMode(savedDarkMode);
    setCurrency(savedCurrency);
    
    // Apply dark mode to document
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }

    // Fetch Tax & VAT settings
    getTaxSettings().then((settings) => {
      setTaxSettings(settings);
    });
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTax(true);
    try {
      await saveTaxSettings(taxSettings);
      toast({
        title: "Settings Saved",
        description: "Tax & VAT settings updated successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update tax settings.",
        variant: "destructive"
      });
    } finally {
      setSavingTax(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Customize your application preferences and tax configuration.</p>
      </div>
      
      {/* Appearance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center">
            <SettingsIcon className="text-blue-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance & Display</h3>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
            <div className="flex items-center">
              {darkMode ? (
                <Moon className="text-blue-600 mr-3" size={20} />
              ) : (
                <Sun className="text-yellow-600 mr-3" size={20} />
              )}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Theme</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {darkMode ? 'Dark mode is enabled' : 'Light mode is enabled'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                darkMode ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Selection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Globe className="text-indigo-600 mr-3" size={20} />
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{t('language')} (System Language)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Select application interface language (English / አማርኛ)
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  language === 'am'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                አማርኛ (Amharic)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tax & Accounting Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center">
            <Receipt className="text-indigo-600 mr-3" size={24} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tax & Accounting Configuration</h3>
          </div>
        </div>

        <form onSubmit={handleSaveTaxSettings} className="p-6 space-y-6">
          {/* Enable VAT Toggle */}
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Enable Value Added Tax (VAT)</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                When enabled, VAT will automatically be calculated on checkout in the POS sales interface.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTaxSettings({ ...taxSettings, vatEnabled: !taxSettings.vatEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                taxSettings.vatEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  taxSettings.vatEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VAT Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard VAT Rate (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxSettings.vatRate}
                  onChange={(e) => setTaxSettings({ ...taxSettings, vatRate: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Default fixed VAT rate (typically 15% in Ethiopia).</p>
            </div>

            {/* Income Tax Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Annual Business Income Tax Rate (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxSettings.incomeTaxRate}
                  onChange={(e) => setTaxSettings({ ...taxSettings, incomeTaxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Ethiopian annual corporate income tax rate on net profit (default 35%).</p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingTax}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:bg-gray-400"
            >
              {savingTax ? 'Saving...' : 'Save Tax Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Category Management Section */}
      <CategoryManager />
    </div>
  );
};

export default Settings;

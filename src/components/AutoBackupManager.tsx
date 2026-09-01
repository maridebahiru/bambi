import React, { useState, useEffect } from 'react';
import { Database, Download, Upload, Clock, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getAutoBackupConfig,
  saveAutoBackupConfig,
  createFullBackup,
  restoreBackupData,
  AutoBackupConfig,
  BackupDataPayload,
} from '../lib/backupService';
import { useToast } from '@/hooks/use-toast';

const AutoBackupManager: React.FC = () => {
  const [config, setConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setConfig(getAutoBackupConfig());
  }, []);

  const handleConfigChange = (key: keyof AutoBackupConfig, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    saveAutoBackupConfig(updated);
    toast({
      title: 'Backup Settings Saved',
      description: 'Your auto-backup configuration has been updated.',
    });
  };

  const handleManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const payload = await createFullBackup(true);
      const updated = { ...config, lastBackupDate: payload.timestamp };
      setConfig(updated);
      saveAutoBackupConfig(updated);
      toast({
        title: 'Backup Complete!',
        description: `Successfully exported full system backup containing ${payload.data.products.length} products and ${payload.data.sales.length} sales records.`,
      });
    } catch (error: any) {
      toast({
        title: 'Backup Failed',
        description: error.message || 'An error occurred while creating backup.',
        variant: 'destructive',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const payload: BackupDataPayload = JSON.parse(text);

        if (!payload.data || !payload.version) {
          throw new Error('Invalid backup file structure.');
        }

        const confirmRestore = window.confirm(
          `Are you sure you want to restore data from backup dated ${new Date(payload.timestamp).toLocaleString()}? This will update existing items.`
        );

        if (!confirmRestore) return;

        setIsRestoring(true);
        const result = await restoreBackupData(payload);

        toast({
          title: 'Restore Completed!',
          description: result.details,
        });
      } catch (err: any) {
        toast({
          title: 'Restore Failed',
          description: err.message || 'Could not parse or restore backup file.',
          variant: 'destructive',
        });
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
      <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Database className="text-blue-600 dark:text-blue-400 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Auto Backup & Data Recovery</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automatically back up inventory, sales records, categories, and settings.
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 ${
            config.enabled
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}
        >
          {config.enabled ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {config.enabled ? 'Auto Backup Active' : 'Auto Backup Disabled'}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Toggle Auto Backup */}
        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Enable Automated System Backups</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Automatically generates system snapshots in the background when due.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleConfigChange('enabled', !config.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              config.enabled ? 'bg-[#2138df]' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Frequency & Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Backup Schedule Frequency
            </label>
            <select
              value={config.frequency}
              disabled={!config.enabled}
              onChange={(e) => handleConfigChange('frequency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-[#2138df] disabled:opacity-50"
            >
              <option value="daily">Daily (Every 24 Hours)</option>
              <option value="weekly">Weekly (Every 7 Days)</option>
              <option value="monthly">Monthly (Every 30 Days)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Last Backup Status
            </label>
            <div className="flex items-center space-x-2 py-2 text-sm text-gray-600 dark:text-gray-300">
              <Clock size={18} className="text-[#dc831c]" />
              <span>
                {config.lastBackupDate
                  ? new Date(config.lastBackupDate).toLocaleString()
                  : 'No backups recorded yet'}
              </span>
            </div>
          </div>
        </div>

        {/* Manual Actions */}
        <div className="pt-4 border-t dark:border-gray-700 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleManualBackup}
            disabled={isBackingUp}
            className="flex items-center px-4 py-2.5 bg-[#2138df] hover:bg-[#182bbd] text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isBackingUp ? (
              <RefreshCw size={16} className="mr-2 animate-spin" />
            ) : (
              <Download size={16} className="mr-2" />
            )}
            {isBackingUp ? 'Creating Backup...' : 'Export & Download Backup JSON'}
          </button>

          <label className="flex items-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg cursor-pointer transition-colors">
            <Upload size={16} className="mr-2 text-[#dc831c]" />
            {isRestoring ? 'Restoring Data...' : 'Restore Data from Backup File'}
            <input
              type="file"
              accept=".json"
              disabled={isRestoring}
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default AutoBackupManager;

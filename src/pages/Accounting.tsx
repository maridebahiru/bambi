import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, Percent, TrendingUp, Truck, Receipt, FileText, UserCheck } from 'lucide-react';
import FinancialOverview from '../components/accounting/FinancialOverview';
import TaxManagement from '../components/accounting/TaxManagement';
import MarginAnalysis from '../components/accounting/MarginAnalysis';
import AccountsPayable from '../components/accounting/AccountsPayable';
import AccountsReceivable from '../components/accounting/AccountsReceivable';
import ExpensesManager from '../components/accounting/ExpensesManager';
import PnLReport from '../components/accounting/PnLReport';
import { getTaxSettings, TaxSettings } from '../lib/taxSettings';

type AccountingTab = 'overview' | 'tax' | 'margins' | 'receivables' | 'payables' | 'expenses' | 'pnl';

const Accounting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AccountingTab>('overview');
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });

  useEffect(() => {
    getTaxSettings().then(setTaxSettings);

    const handleTaxChange = (e: CustomEvent<TaxSettings>) => {
      if (e.detail) {
        setTaxSettings(e.detail);
      }
    };

    window.addEventListener('taxSettingsChanged', handleTaxChange as EventListener);
    return () => {
      window.removeEventListener('taxSettingsChanged', handleTaxChange as EventListener);
    };
  }, []);

  const tabs = [
    { id: 'overview', label: 'Financial Overview', icon: DollarSign },
    { id: 'tax', label: 'Tax & VAT', icon: Percent },
    { id: 'margins', label: 'Margin Analysis', icon: TrendingUp },
    { id: 'receivables', label: 'Accounts Receivable', icon: UserCheck },
    { id: 'payables', label: 'Accounts Payable', icon: Truck },
    { id: 'expenses', label: 'Operating Expenses', icon: Receipt },
    { id: 'pnl', label: 'P&L Statement', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Calculator className="text-blue-600 mr-2.5" size={28} />
            Accounting & Financial Management
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm">
            Track gross margins, VAT, Ethiopian annual income tax (35%), customer loan receivables, payables aging, and financial statements.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg shadow-sm px-4 pt-2">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AccountingTab)}
                className={`flex items-center space-x-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div>
        {activeTab === 'overview' && <FinancialOverview incomeTaxRate={taxSettings.incomeTaxRate} />}
        {activeTab === 'tax' && <TaxManagement incomeTaxRate={taxSettings.incomeTaxRate} vatRate={taxSettings.vatRate} />}
        {activeTab === 'margins' && <MarginAnalysis />}
        {activeTab === 'receivables' && <AccountsReceivable />}
        {activeTab === 'payables' && <AccountsPayable />}
        {activeTab === 'expenses' && <ExpensesManager />}
        {activeTab === 'pnl' && <PnLReport incomeTaxRate={taxSettings.incomeTaxRate} />}
      </div>
    </div>
  );
};

export default Accounting;

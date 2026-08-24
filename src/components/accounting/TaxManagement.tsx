import React, { useState, useEffect } from 'react';
import { Percent, Receipt, AlertCircle, FileText, Calendar, CheckSquare, Info, Filter } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { TimeFilter } from './FinancialOverview';

interface SaleDoc {
  id: string;
  subtotal?: number;
  totalPrice?: number;
  vatRate?: number;
  vatAmount?: number;
  unitPrice: number;
  quantity: number;
  unitCost?: number;
  date: string;
  sentToCashRegister?: boolean;
  timestamp?: any;
}

interface ExpenseDoc {
  id: string;
  amount: number;
  date: string;
  timestamp?: any;
}

interface TaxManagementProps {
  incomeTaxRate?: number;
  vatRate?: number;
}

const TaxManagement: React.FC<TaxManagementProps> = ({ incomeTaxRate = 35, vatRate = 15 }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default 1st of current month
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [taxFilterMode, setTaxFilterMode] = useState<'cashRegisterOnly' | 'allSales'>('cashRegisterOnly');
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
      ]);

      const salesData = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SaleDoc[];
      const expensesData = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseDoc[];

      setSales(salesData);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading tax data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setPresetRange = (preset: 'today' | 'week' | 'month' | 'ytd' | 'all') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    setEndDate(todayStr);

    if (preset === 'today') {
      setStartDate(todayStr);
    } else if (preset === 'week') {
      const start = new Date();
      start.setDate(now.getDate() - 7);
      const sY = start.getFullYear();
      const sM = String(start.getMonth() + 1).padStart(2, '0');
      const sD = String(start.getDate()).padStart(2, '0');
      setStartDate(`${sY}-${sM}-${sD}`);
    } else if (preset === 'month') {
      setStartDate(`${year}-${month}-01`);
    } else if (preset === 'ytd') {
      setStartDate(`${year}-01-01`);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const getItemLocalDateString = (item: { timestamp?: any; date?: string }) => {
    let dateObj: Date | null = null;
    if (item.timestamp?.toDate) {
      dateObj = item.timestamp.toDate();
    } else if (item.timestamp?.seconds) {
      dateObj = new Date(item.timestamp.seconds * 1000);
    } else if (item.date) {
      const str = String(item.date).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
      }
      dateObj = new Date(str);
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const isItemInDateRange = (item: { timestamp?: any; date?: string }) => {
    const d = getItemLocalDateString(item);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filteredSales = sales.filter(s => isItemInDateRange(s));
  const filteredExpenses = expenses.filter(e => isItemInDateRange(e));

  // Count Cash Register vs Unlinked Sales
  const cashRegisterSalesList = filteredSales.filter(s => s.sentToCashRegister === true);
  const unlinkedSalesList = filteredSales.filter(s => s.sentToCashRegister !== true);

  const totalSalesCount = filteredSales.length;
  const cashRegisterSalesCount = cashRegisterSalesList.length;
  const unlinkedSalesCount = unlinkedSalesList.length;

  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);
  const cashRegisterRevenue = cashRegisterSalesList.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);
  const unlinkedRevenue = unlinkedSalesList.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);

  // Active sales set for 35% Income Tax Calculation
  const activeTaxSales = taxFilterMode === 'cashRegisterOnly' ? cashRegisterSalesList : filteredSales;

  // VAT calculations (across all sales in period)
  let totalVatCollected = 0;
  let vatTaxableSales = 0;
  let vatExemptSales = 0;

  filteredSales.forEach(s => {
    const sub = s.subtotal ?? (s.unitPrice * s.quantity);
    if (s.vatAmount && s.vatAmount > 0) {
      totalVatCollected += s.vatAmount;
      vatTaxableSales += sub;
    } else {
      vatExemptSales += sub;
    }
  });

  // Income Tax (35% Ethiopian Tax) calculations
  const grossRevenue = activeTaxSales.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);
  const cogs = activeTaxSales.reduce((sum, s) => sum + ((s.unitCost ?? (s.unitPrice * 0.7)) * s.quantity), 0);
  const grossProfit = grossRevenue - cogs;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Proportional expense allocation for cash register sales subset
  const allocatedExpenses = (taxFilterMode === 'cashRegisterOnly' && totalSalesRevenue > 0)
    ? (grossRevenue / totalSalesRevenue) * totalExpenses
    : totalExpenses;

  const netTaxableIncome = Math.max(0, grossProfit - allocatedExpenses);
  const accruedIncomeTaxLiability = netTaxableIncome * (incomeTaxRate / 100);

  return (
    <div className="space-y-6">
      {/* Date Filter & Cash Register Toggle Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 font-semibold text-sm">
            <Calendar size={18} className="text-indigo-600" />
            <span>Date Range:</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1 border-l dark:border-gray-700 pl-2">
            <button onClick={() => setPresetRange('today')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">Today</button>
            <button onClick={() => setPresetRange('month')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">This Month</button>
            <button onClick={() => setPresetRange('ytd')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">This Year</button>
            <button onClick={() => setPresetRange('all')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">All Time</button>
          </div>
        </div>

        {/* 35% Tax Calculation Filter Mode Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg border dark:border-gray-600">
          <button
            onClick={() => setTaxFilterMode('cashRegisterOnly')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              taxFilterMode === 'cashRegisterOnly'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            <CheckSquare size={14} />
            <span>Cash Register Sales Only ({cashRegisterSalesCount})</span>
          </button>
          <button
            onClick={() => setTaxFilterMode('allSales')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              taxFilterMode === 'allSales'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
            }`}
          >
            <Filter size={14} />
            <span>Include All Sales ({totalSalesCount})</span>
          </button>
        </div>
      </div>

      {/* Cash Register Breakdown Status Banner */}
      <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-900 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg font-bold">
            All Sales
          </div>
          <div>
            <div className="text-gray-500 font-medium">Total Sales in Period</div>
            <div className="text-base font-bold text-gray-900 dark:text-white">{totalSalesCount} sales (Br {totalSalesRevenue.toFixed(2)})</div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-lg font-bold">
            Cash Register
          </div>
          <div>
            <div className="text-gray-500 font-medium">Cash Register Linked (35% Tax)</div>
            <div className="text-base font-bold text-amber-900 dark:text-amber-200">{cashRegisterSalesCount} sales (Br {cashRegisterRevenue.toFixed(2)})</div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-bold">
            Unlinked
          </div>
          <div>
            <div className="text-gray-500 font-medium">Unlinked / Regular Sales</div>
            <div className="text-base font-bold text-gray-700 dark:text-gray-300">{unlinkedSalesCount} sales (Br {unlinkedRevenue.toFixed(2)})</div>
          </div>
        </div>
      </div>

      {/* VAT Summary Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3">
          <div className="flex items-center space-x-2">
            <Receipt className="text-indigo-600" size={22} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">VAT Collection Summary ({vatRate}%)</h3>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-3 py-1 rounded-full font-medium">
            Per-Sale Tax
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border dark:border-gray-700">
            <p className="text-xs text-gray-500 font-medium uppercase">Total VAT Collected</p>
            <h4 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">Br {totalVatCollected.toFixed(2)}</h4>
            <p className="text-xs text-gray-500 mt-1">Held for tax authority filing</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border dark:border-gray-700">
            <p className="text-xs text-gray-500 font-medium uppercase">VAT-Taxable Net Sales</p>
            <h4 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Br {vatTaxableSales.toFixed(2)}</h4>
            <p className="text-xs text-gray-500 mt-1">Sales with {vatRate}% VAT applied</p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-lg border dark:border-gray-700">
            <p className="text-xs text-gray-500 font-medium uppercase">VAT-Exempt Sales</p>
            <h4 className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">Br {vatExemptSales.toFixed(2)}</h4>
            <p className="text-xs text-gray-500 mt-1">Sales exempted from VAT</p>
          </div>
        </div>
      </div>

      {/* Ethiopian Income Tax Liability Section */}
      <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-xl shadow-sm border border-amber-200 dark:border-amber-900/50 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-200 dark:border-amber-900/50 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <Percent className="text-amber-700 dark:text-amber-400" size={22} />
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">Ethiopian Business Income Tax Liability ({incomeTaxRate}%)</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {taxFilterMode === 'cashRegisterOnly'
                  ? `Calculated strictly for ${cashRegisterSalesCount} sale(s) flagged as 'Sent to Cash Register'`
                  : `Calculated for all ${totalSalesCount} sale(s) in selected period`}
              </p>
            </div>
          </div>

          <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-3 py-1 rounded-full font-bold w-fit">
            Mode: {taxFilterMode === 'cashRegisterOnly' ? 'Cash Register Linked Only' : 'All Sales Included'}
          </span>
        </div>

        {/* Info Banner if 0 Cash Register sales or Net Profit = 0 */}
        {taxFilterMode === 'cashRegisterOnly' && cashRegisterSalesCount === 0 && (
          <div className="p-4 bg-amber-100/80 border border-amber-300 text-amber-900 rounded-lg text-xs flex items-start space-x-3">
            <Info size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">No Cash Register sales found for this date period.</p>
              <p className="mt-0.5">
                To link a sale to the 35% tax calculation, ensure <strong>"Sent to Cash Register"</strong> is checked during POS checkout, or click <strong>"Include All Sales"</strong> above to view tax liability across all sales.
              </p>
            </div>
          </div>
        )}

        {/* Accrued Tax Highlight Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-amber-300 dark:border-amber-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase">
              <AlertCircle size={15} />
              <span>Estimated Accrued Income Tax Liability ({incomeTaxRate}%):</span>
            </div>
            <h2 className="text-3xl font-extrabold text-amber-900 dark:text-amber-100 mt-2">
              Br {accruedIncomeTaxLiability.toFixed(2)}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Based on Taxable Net Profit of Br {netTaxableIncome.toFixed(2)} @ {incomeTaxRate}% rate
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg text-xs space-y-1 text-amber-900 dark:text-amber-200 max-w-sm">
            <p className="font-semibold">Ethiopian Corporate Tax Rule:</p>
            <p className="text-gray-600 dark:text-gray-300">
              Business profit tax applies to Net Profit (Gross Sales Revenue - COGS - Allowable Operating Expenses).
            </p>
          </div>
        </div>

        {/* Tax Computation Breakdown Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50 dark:bg-gray-750 font-semibold text-sm text-gray-900 dark:text-white border-b dark:border-gray-700 flex justify-between items-center">
            <span>Accrued Tax Calculation Breakdown</span>
            <span className="text-xs font-normal text-gray-500">
              {activeTaxSales.length} sale item(s) evaluated
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium">
                  Gross Sales Revenue ({taxFilterMode === 'cashRegisterOnly' ? 'Cash Register Linked' : 'All Sales'})
                </td>
                <td className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-white">Br {grossRevenue.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium">Less: Cost of Goods Sold (COGS)</td>
                <td className="px-6 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">- Br {cogs.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50/50 dark:bg-gray-750/50">
                <td className="px-6 py-3 text-gray-900 dark:text-white font-bold">Gross Operating Profit</td>
                <td className="px-6 py-3 text-right font-bold text-gray-900 dark:text-white">Br {grossProfit.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium">
                  Less: Allowable Operating Expenses {taxFilterMode === 'cashRegisterOnly' ? '(Proportional Share)' : ''}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-red-600 dark:text-red-400">- Br {allocatedExpenses.toFixed(2)}</td>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-750">
                <td className="px-6 py-3 text-gray-900 dark:text-white font-bold">Taxable Net Profit</td>
                <td className="px-6 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">Br {netTaxableIncome.toFixed(2)}</td>
              </tr>
              <tr className="bg-amber-100/60 dark:bg-amber-950/40">
                <td className="px-6 py-3 text-amber-900 dark:text-amber-200 font-bold flex items-center">
                  <span>Accrued Income Tax Liability ({incomeTaxRate}%)</span>
                </td>
                <td className="px-6 py-3 text-right font-extrabold text-amber-900 dark:text-amber-200 text-base">
                  Br {accruedIncomeTaxLiability.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TaxManagement;

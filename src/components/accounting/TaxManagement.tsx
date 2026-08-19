import React, { useState, useEffect } from 'react';
import { Percent, Receipt, AlertCircle, FileText, Calendar } from 'lucide-react';
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
}

interface ExpenseDoc {
  id: string;
  amount: number;
  date: string;
}

interface TaxManagementProps {
  incomeTaxRate?: number;
  vatRate?: number;
}

const TaxManagement: React.FC<TaxManagementProps> = ({ incomeTaxRate = 35, vatRate = 15 }) => {
  const [filter, setFilter] = useState<TimeFilter>('ytd');
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

  const isDateInFilter = (dateStr: string) => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    const now = new Date();
    
    if (filter === 'day') return itemDate.toDateString() === now.toDateString();
    if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return itemDate >= oneWeekAgo;
    }
    if (filter === 'month') return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    if (filter === 'ytd') return itemDate.getFullYear() === now.getFullYear();
    return true;
  };

  const filteredSales = sales.filter(s => isDateInFilter(s.date));
  const filteredExpenses = expenses.filter(e => isDateInFilter(e.date));

  // VAT calculations
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
  const grossRevenue = filteredSales.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);
  const cogs = filteredSales.reduce((sum, s) => sum + ((s.unitCost ?? (s.unitPrice * 0.7)) * s.quantity), 0);
  const grossProfit = grossRevenue - cogs;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netTaxableIncome = Math.max(0, grossProfit - totalExpenses);
  const accruedIncomeTaxLiability = netTaxableIncome * (incomeTaxRate / 100);

  return (
    <div className="space-y-6">
      {/* Date Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 font-medium text-sm">
          <Calendar size={18} className="text-indigo-600" />
          <span>Tax Period Granularity:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['day', 'week', 'month', 'ytd', 'all'] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {f === 'day' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'ytd' ? 'Year-To-Date' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* VAT Summary Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 space-y-4">
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
      <div className="bg-amber-50/40 dark:bg-amber-950/20 rounded-lg shadow-sm border border-amber-200 dark:border-amber-900/50 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-900/50 pb-3">
          <div className="flex items-center space-x-2">
            <Percent className="text-amber-700 dark:text-amber-400" size={22} />
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">Ethiopian Business Income Tax Liability ({incomeTaxRate}%)</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">Annual tax calculated continuously as a running accrued liability</p>
            </div>
          </div>
        </div>

        {/* Accrued Tax Highlight Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-amber-300 dark:border-amber-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 text-xs font-bold uppercase">
              <AlertCircle size={15} />
              <span>If the year ended today, your estimated Income Tax liability is:</span>
            </div>
            <h2 className="text-3xl font-extrabold text-amber-900 dark:text-amber-100 mt-2">
              Br {accruedIncomeTaxLiability.toFixed(2)}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Based on Net Profit-to-date of Br {netTaxableIncome.toFixed(2)} @ {incomeTaxRate}% rate
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg text-xs space-y-1 text-amber-900 dark:text-amber-200 max-w-sm">
            <p className="font-semibold">Ethiopian Corporate Tax Rule:</p>
            <p className="text-gray-600 dark:text-gray-300">
              Under Ethiopian Tax Law, business profit tax applies to net profit (Revenue - Cost of Goods - Operating Expenses).
            </p>
          </div>
        </div>

        {/* Tax Computation Breakdown Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-750 font-semibold text-sm text-gray-900 dark:text-white border-b dark:border-gray-700">
            Accrued Tax Calculation Breakdown
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              <tr>
                <td className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium">Gross Sales Revenue</td>
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
                <td className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium">Less: Allowable Operating Expenses</td>
                <td className="px-6 py-3 text-right font-semibold text-red-600 dark:text-red-400">- Br {totalExpenses.toFixed(2)}</td>
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

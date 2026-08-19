import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Receipt, Percent, Calendar, UserCheck, Wallet } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface SaleDoc {
  id: string;
  subtotal?: number;
  totalPrice?: number;
  vatAmount?: number;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  date: string;
  timestamp: any;
}

interface ExpenseDoc {
  id: string;
  amount: number;
  date: string;
}

interface ReceivableDoc {
  id: string;
  balanceRemaining: number;
  dueDate: string;
  status: string;
  createdAt?: any;
}

interface ProductDoc {
  id: string;
  purchasePrice?: number;
  price: number;
}

export type TimeFilter = 'day' | 'week' | 'month' | 'ytd' | 'all';

interface FinancialOverviewProps {
  incomeTaxRate?: number;
}

const FinancialOverview: React.FC<FinancialOverviewProps> = ({ incomeTaxRate = 35 }) => {
  const [filter, setFilter] = useState<TimeFilter>('month');
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [receivables, setReceivables] = useState<ReceivableDoc[]>([]);
  const [products, setProducts] = useState<Record<string, ProductDoc>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [salesSnap, expensesSnap, productsSnap, receivablesSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'receivables')),
      ]);

      const productMap: Record<string, ProductDoc> = {};
      productsSnap.docs.forEach(doc => {
        productMap[doc.id] = { id: doc.id, ...doc.data() } as ProductDoc;
      });
      setProducts(productMap);

      const salesData = salesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaleDoc[];
      setSales(salesData);

      const expensesData = expensesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExpenseDoc[];
      setExpenses(expensesData);

      const receivablesData = receivablesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReceivableDoc[];
      setReceivables(receivablesData);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDateInFilter = (dateStr: string) => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    const now = new Date();
    
    if (filter === 'day') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return itemDate >= oneWeekAgo;
    }
    if (filter === 'month') {
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }
    if (filter === 'ytd') {
      return itemDate.getFullYear() === now.getFullYear();
    }
    return true; // 'all'
  };

  const filteredSales = sales.filter(s => isDateInFilter(s.date));
  const filteredExpenses = expenses.filter(e => isDateInFilter(e.date));

  // Outstanding receivables (total unpaid customer loan balances)
  const totalOutstandingReceivables = receivables
    .filter(r => r.status !== 'Paid')
    .reduce((sum, r) => sum + (r.balanceRemaining || 0), 0);

  // Revenue calculation
  const grossRevenue = filteredSales.reduce((sum, sale) => {
    if (sale.subtotal !== undefined) return sum + sale.subtotal;
    if (sale.totalPrice !== undefined && sale.vatAmount !== undefined) return sum + (sale.totalPrice - sale.vatAmount);
    return sum + (sale.unitPrice * sale.quantity);
  }, 0);

  // Cash Collected vs Accrual Revenue
  const cashCollected = Math.max(0, grossRevenue - totalOutstandingReceivables);

  // COGS calculation
  const totalCogs = filteredSales.reduce((sum, sale) => {
    if (sale.unitCost !== undefined && sale.unitCost > 0) {
      return sum + (sale.unitCost * sale.quantity);
    }
    // Fallback to product purchasePrice
    const p = sale.id ? products[sale.id] : null;
    const cost = p?.purchasePrice || (sale.unitPrice * 0.7); // 70% cost estimate if missing
    return sum + (cost * sale.quantity);
  }, 0);

  const totalVat = filteredSales.reduce((sum, sale) => sum + (sale.vatAmount || 0), 0);
  const grossMargin = grossRevenue - totalCogs;
  const grossMarginPercent = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
  const operatingExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfitBeforeTax = grossMargin - operatingExpenses;
  
  // Accrued Income Tax (35% Ethiopian Tax Law)
  const accruedIncomeTax = netProfitBeforeTax > 0 ? netProfitBeforeTax * (incomeTaxRate / 100) : 0;
  const netProfitAfterTax = netProfitBeforeTax - accruedIncomeTax;

  // Chart data aggregation by date
  const chartDataMap: Record<string, { date: string; revenue: number; cogs: number; profit: number }> = {};

  filteredSales.forEach(sale => {
    const d = sale.date || 'Unknown';
    if (!chartDataMap[d]) {
      chartDataMap[d] = { date: d, revenue: 0, cogs: 0, profit: 0 };
    }
    const rev = sale.subtotal ?? (sale.unitPrice * sale.quantity);
    const cost = (sale.unitCost ?? (sale.unitPrice * 0.7)) * sale.quantity;
    chartDataMap[d].revenue += rev;
    chartDataMap[d].cogs += cost;
    chartDataMap[d].profit += (rev - cost);
  });

  const chartData = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {/* Time Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 font-medium text-sm">
          <Calendar size={18} className="text-blue-600" />
          <span>Financial Period Filter:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['day', 'week', 'month', 'ytd', 'all'] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              {f === 'day' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : f === 'ytd' ? 'Year-To-Date' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Revenue</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Br {grossRevenue.toFixed(2)}</h3>
              <p className="text-xs text-gray-500 mt-1">Accrual Sales Total</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Customer Debts</p>
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">Br {totalOutstandingReceivables.toFixed(2)}</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Uncollected Credit Balance</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-lg">
              <UserCheck size={20} />
            </div>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total COGS</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Br {totalCogs.toFixed(2)}</h3>
              <p className="text-xs text-gray-500 mt-1">Product Purchase Costs</p>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 rounded-lg text-orange-600 dark:text-orange-400">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>

        {/* Gross Margin */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Margin</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Br {grossMargin.toFixed(2)}</h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">{grossMarginPercent.toFixed(1)}% Margin Rate</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Percent size={20} />
            </div>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</p>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">Br {operatingExpenses.toFixed(2)}</h3>
              <p className="text-xs text-gray-500 mt-1">{filteredExpenses.length} Expense Logs</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-red-600 dark:text-red-400">
              <Receipt size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Tax & Net Profit Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Net Profit Before Tax */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Net Profit (Before Tax)</p>
          <h4 className={`text-xl font-bold mt-2 ${netProfitBeforeTax >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
            Br {netProfitBeforeTax.toFixed(2)}
          </h4>
          <p className="text-xs text-gray-500 mt-1">Gross Margin - Expenses</p>
        </div>

        {/* Accrued Ethiopian Income Tax Liability */}
        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Accrued Income Tax ({incomeTaxRate}%)</p>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded">Ethiopian Law</span>
          </div>
          <h4 className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-2">
            Br {accruedIncomeTax.toFixed(2)}
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Running liability on Net Profit</p>
        </div>

        {/* Net Profit After Tax */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Net Profit (After Tax)</p>
          <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-2">
            Br {netProfitAfterTax.toFixed(2)}
          </h4>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Final Bottom Line</p>
        </div>
      </div>

      {/* Financial Trend Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue & Profitability Trend</h3>
        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number) => `Br ${value.toFixed(2)}`} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="profit" name="Gross Profit" stroke="#059669" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No transaction data recorded for this period.</div>
        )}
      </div>
    </div>
  );
};

export default FinancialOverview;

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
  sentToCashRegister?: boolean;
}

interface ExpenseDoc {
  id: string;
  amount: number;
  date: string;
  timestamp?: any;
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
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default 1st day of current month
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
    const p = sale.id ? products[sale.id] : null;
    const cost = p?.purchasePrice || (sale.unitPrice * 0.7);
    return sum + (cost * sale.quantity);
  }, 0);

  const totalVat = filteredSales.reduce((sum, sale) => sum + (sale.vatAmount || 0), 0);
  const grossMargin = grossRevenue - totalCogs;
  const grossMarginPercent = grossRevenue > 0 ? (grossMargin / grossRevenue) * 100 : 0;
  const operatingExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfitBeforeTax = grossMargin - operatingExpenses;
  
  // Accrued Income Tax (35% Ethiopian Tax Law) - Calculated on Net Taxable Profit for the period
  const accruedIncomeTax = netProfitBeforeTax > 0 ? netProfitBeforeTax * (incomeTaxRate / 100) : 0;
  const netProfitAfterTax = netProfitBeforeTax - accruedIncomeTax;

  // Chart data aggregation by date
  const chartDataMap: Record<string, { date: string; revenue: number; cogs: number; profit: number }> = {};

  filteredSales.forEach(sale => {
    const d = getItemLocalDateString(sale);
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 font-semibold text-sm">
            <Calendar size={18} className="text-blue-600" />
            <span>Date Filter:</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium mr-1">Presets:</span>
          <button onClick={() => setPresetRange('today')} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold">Today</button>
          <button onClick={() => setPresetRange('month')} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold">This Month</button>
          <button onClick={() => setPresetRange('ytd')} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold">This Year</button>
          <button onClick={() => setPresetRange('all')} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold">All Time</button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Revenue</p>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">Br {grossRevenue.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Accrual basis sales total</p>
        </div>

        {/* Cost of Goods Sold (COGS) */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total COGS</p>
              <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">Br {totalCogs.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950 text-orange-600 rounded-lg">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Product inventory cost</p>
        </div>

        {/* Gross Operating Margin */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross Margin</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">Br {grossMargin.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-2">{grossMarginPercent.toFixed(1)}% Gross Margin</p>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operating Expenses</p>
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">Br {operatingExpenses.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-950 text-red-600 rounded-lg">
              <Receipt size={20} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Rent, utilities, transport, etc.</p>
        </div>

        {/* Net Profit After Tax */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Profit (After Tax)</p>
              <h3 className={`text-xl font-bold mt-1 ${netProfitAfterTax >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
                Br {netProfitAfterTax.toFixed(2)}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
              <Wallet size={20} />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">After 35% income tax deduction</p>
        </div>
      </div>

      {/* Financial Metrics Highlights Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">Customer Credit Receivables (Unpaid)</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">Br {totalOutstandingReceivables.toFixed(2)}</p>
          </div>
          <UserCheck size={24} className="text-amber-500 opacity-80" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">Net Taxable Profit (Before Tax)</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">Br {netProfitBeforeTax.toFixed(2)}</p>
          </div>
          <DollarSign size={24} className="text-blue-500 opacity-80" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-medium">Accrued 35% Income Tax Liability</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 mt-0.5">Br {accruedIncomeTax.toFixed(2)}</p>
          </div>
          <Percent size={24} className="text-amber-600 opacity-80" />
        </div>
      </div>

      {/* Revenue & Profit Trends Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border dark:border-gray-700 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Financial Performance Trend</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [`Br ${val.toFixed(2)}`, '']} />
              <Area type="monotone" dataKey="revenue" name="Gross Revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="profit" name="Gross Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FinancialOverview;

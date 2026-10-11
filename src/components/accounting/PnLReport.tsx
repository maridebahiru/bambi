import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, DollarSign, UserCheck } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../contexts/AuthContext';

interface SaleDoc {
  id: string;
  subtotal?: number;
  totalPrice?: number;
  vatAmount?: number;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  sellerId?: string;
  sellerName?: string;
  date: string;
  timestamp?: any;
  sentToCashRegister?: boolean;
}

interface ReceivableDoc {
  id: string;
  balanceRemaining: number;
  dueDate: string;
  status: string;
  createdAt?: any;
}

interface ExpenseDoc {
  id: string;
  category?: string;
  amount: number;
  date: string;
  timestamp?: any;
}

interface PnLReportProps {
  incomeTaxRate?: number;
}

const PnLReport: React.FC<PnLReportProps> = ({ incomeTaxRate = 35 }) => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
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
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesSnap, expensesSnap, receivablesSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'receivables')),
      ]);

      const salesData = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as SaleDoc[];
      const expensesData = expensesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ExpenseDoc[];
      const receivablesData = receivablesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ReceivableDoc[];

      setSales(salesData);
      setExpenses(expensesData);
      setReceivables(receivablesData);
    } catch (e) {
      console.error('Error fetching PnL data:', e);
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

  // Unpaid Customer Receivables
  const totalUncollectedReceivables = receivables
    .filter(r => r.status !== 'Paid')
    .reduce((sum, r) => sum + (r.balanceRemaining || 0), 0);

  // Calculations
  const grossRevenue = filteredSales.reduce((sum, s) => sum + (s.subtotal ?? (s.unitPrice * s.quantity)), 0);
  const totalCogs = filteredSales.reduce((sum, s) => sum + ((s.unitCost ?? (s.unitPrice * 0.7)) * s.quantity), 0);
  const grossProfit = grossRevenue - totalCogs;

  // Expenses breakdown by category
  const expenseCatMap: Record<string, number> = {};
  let totalExpenses = 0;

  filteredExpenses.forEach(e => {
    const cat = e.category || 'Other';
    expenseCatMap[cat] = (expenseCatMap[cat] || 0) + e.amount;
    totalExpenses += e.amount;
  });

  // Income Tax (35% Ethiopian Tax) - Calculated on Net Taxable Profit of the statement period
  const netProfitBeforeTax = grossProfit - totalExpenses;
  const accruedIncomeTax = netProfitBeforeTax > 0 ? netProfitBeforeTax * (incomeTaxRate / 100) : 0;
  const netProfitAfterTax = netProfitBeforeTax - accruedIncomeTax;

  // Cashier attribution
  const sellerAttributionMap: Record<string, { name: string; salesCount: number; revenue: number }> = {};
  filteredSales.forEach(s => {
    const name = s.sellerName || 'General Staff';
    if (!sellerAttributionMap[name]) {
      sellerAttributionMap[name] = { name, salesCount: 0, revenue: 0 };
    }
    const rev = s.subtotal ?? (s.unitPrice * s.quantity);
    sellerAttributionMap[name].salesCount += 1;
    sellerAttributionMap[name].revenue += rev;
  });

  const exportPnLPdf = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('PROFIT & LOSS (P&L) STATEMENT', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text('BAMBI STORE', 105, 28, { align: 'center' });
    doc.text(`Period: ${startDate} to ${endDate}`, 105, 34, { align: 'center' });
    doc.text(`Generated By: ${userProfile?.name || 'Admin'} on ${new Date().toLocaleDateString()}`, 105, 40, { align: 'center' });
    
    doc.line(20, 46, 190, 46);
    
    let y = 56;
    doc.setFontSize(12);

    // Section 1: Revenue & COGS
    doc.setFont('helvetica', 'bold');
    doc.text('1. REVENUE & COST OF GOODS SOLD', 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.text('Gross Operating Sales Revenue', 25, y);
    doc.text(`Br ${grossRevenue.toFixed(2)}`, 185, y, { align: 'right' });
    y += 8;

    doc.text('Less: Cost of Goods Sold (COGS)', 25, y);
    doc.text(`(Br ${totalCogs.toFixed(2)})`, 185, y, { align: 'right' });
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('GROSS OPERATING PROFIT', 25, y);
    doc.text(`Br ${grossProfit.toFixed(2)}`, 185, y, { align: 'right' });
    y += 12;
    doc.setFont('helvetica', 'normal');

    // Section 2: Operating Expenses
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. OPERATING EXPENSES', 20, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    if (Object.keys(expenseCatMap).length > 0) {
      Object.entries(expenseCatMap).forEach(([cat, amount]) => {
        doc.text(`Expense: ${cat}`, 25, y);
        doc.text(`Br ${amount.toFixed(2)}`, 185, y, { align: 'right' });
        y += 7;
      });
    } else {
      doc.text('No Operating Expenses Logged in Period', 25, y);
      y += 7;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL OPERATING EXPENSES', 25, y);
    doc.text(`(Br ${totalExpenses.toFixed(2)})`, 185, y, { align: 'right' });
    y += 12;

    // Section 3: Profitability & Tax
    doc.setFontSize(12);
    doc.text('3. NET PROFIT & TAX SUMMARY', 20, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NET OPERATING PROFIT (BEFORE TAX)', 25, y);
    doc.text(`Br ${netProfitBeforeTax.toFixed(2)}`, 185, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text(`Less: Accrued Corporate Income Tax (${incomeTaxRate}%)`, 25, y);
    doc.text(`(Br ${accruedIncomeTax.toFixed(2)})`, 185, y, { align: 'right' });
    y += 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NET PROFIT AFTER TAX (BOTTOM LINE)', 25, y);
    doc.text(`Br ${netProfitAfterTax.toFixed(2)}`, 185, y, { align: 'right' });
    y += 20;

    // Footer signature line
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared by: ________________________', 25, y);
    doc.text('Approved by: ________________________', 120, y);

    doc.save(`PnL_Statement_${startDate}_to_${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Date Filter & Export Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Calendar size={18} className="text-indigo-600" />
            <span>P&L Date Filter:</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-gray-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium dark:bg-gray-700 dark:text-white"
            />
            <span className="text-gray-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex items-center space-x-1 border-l dark:border-gray-700 pl-2">
            <button onClick={() => setPresetRange('today')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">Today</button>
            <button onClick={() => setPresetRange('month')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">This Month</button>
            <button onClick={() => setPresetRange('ytd')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">This Year</button>
            <button onClick={() => setPresetRange('all')} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">All Time</button>
          </div>
        </div>

        <button
          onClick={exportPnLPdf}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          <Download size={16} className="mr-2" />
          Export P&L Report to PDF
        </button>
      </div>

      {/* Primary Financial Overview Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-750 font-bold text-gray-900 dark:text-white border-b dark:border-gray-700">
          PROFIT & LOSS STATEMENT ({startDate || 'Beginning'} to {endDate || 'Today'})
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Revenue & COGS */}
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-3">1. Operating Revenue & Cost of Sales</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Gross Operating Revenue (Total Sales)</span>
                <span className="font-semibold text-gray-900 dark:text-white">Br {grossRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Less: Cost of Goods Sold (COGS)</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">- Br {totalCogs.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 bg-gray-50 dark:bg-gray-750 px-3 rounded font-bold text-gray-900 dark:text-white">
                <span>GROSS OPERATING PROFIT</span>
                <span className="text-emerald-600 dark:text-emerald-400">Br {grossProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Operating Expenses */}
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-3">2. Operating Expenses</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(expenseCatMap).map(([cat, amount]) => (
                <div key={cat} className="flex justify-between py-1.5 border-b dark:border-gray-700">
                  <span className="text-gray-600 dark:text-gray-400">{cat} Expenses</span>
                  <span className="font-medium text-red-600 dark:text-red-400">Br {amount.toFixed(2)}</span>
                </div>
              ))}
              {Object.keys(expenseCatMap).length === 0 && (
                <p className="text-xs text-gray-400 italic">No expenses logged in this period</p>
              )}
              <div className="flex justify-between py-2 bg-red-50 dark:bg-red-950 px-3 rounded font-bold text-red-700 dark:text-red-300">
                <span>TOTAL OPERATING EXPENSES</span>
                <span>- Br {totalExpenses.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Net Profit & Tax Breakdown */}
          <div>
            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-3">3. Net Profitability & Corporate Tax</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                <span>Net Taxable Profit (Before Tax)</span>
                <span>Br {netProfitBeforeTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Less: Accrued Corporate Income Tax ({incomeTaxRate}%)</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">- Br {accruedIncomeTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 bg-emerald-50 dark:bg-emerald-950 px-4 rounded-lg font-extrabold text-base">
                <span className="text-emerald-900 dark:text-emerald-200">NET PROFIT AFTER TAX (BOTTOM LINE)</span>
                <span className="text-emerald-700 dark:text-emerald-300">Br {netProfitAfterTax.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PnLReport;

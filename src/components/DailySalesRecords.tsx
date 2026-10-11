import React, { useState, useEffect } from 'react';
import { Printer, Paperclip, User, CreditCard, Calendar, Filter, RotateCcw, Download } from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { generateSaleReceipt } from './PDFGenerator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from "@/hooks/use-toast";

interface SaleRecord {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  buyerName: string;
  sellerName: string;
  timestamp: any;
  date: string;
  paymentMethod?: string;
}

const DailySalesRecords = () => {
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchSalesRecords();
  }, []);

  const fetchSalesRecords = async () => {
    try {
      const salesQuery = query(
        collection(db, 'sales'),
        orderBy('timestamp', 'desc')
      );
      const salesSnapshot = await getDocs(salesQuery);
      const salesData = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaleRecord[];
      setSalesRecords(salesData);
    } catch (error) {
      console.error('Error fetching sales records:', error);
      toast({
        title: "Error",
        description: "Failed to load sales records",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isToday = (timestamp: any) => {
    if (!timestamp) return false;
    const saleDate = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    return (
      saleDate.getDate() === today.getDate() &&
      saleDate.getMonth() === today.getMonth() &&
      saleDate.getFullYear() === today.getFullYear()
    );
  };

  const filteredSalesRecords = salesRecords.filter((record) => {
    // 1. Date Filter (Defaults to Today's sales only)
    if (dateFilter === 'today' && !isToday(record.timestamp)) {
      return false;
    }

    // 2. Seller Filter
    if (selectedSeller && record.sellerName !== selectedSeller) {
      return false;
    }

    // 3. Payment Method Filter
    if (selectedPaymentMethod && (record.paymentMethod || 'N/A') !== selectedPaymentMethod) {
      return false;
    }

    return true;
  });

  // Extract unique sellers & payment methods for filter dropdowns
  const uniqueSellers = Array.from(new Set(salesRecords.map(r => r.sellerName).filter(Boolean))).sort();
  const uniquePaymentMethods = Array.from(new Set(salesRecords.map(r => r.paymentMethod || 'N/A').filter(Boolean))).sort();

  const handleResetFilters = () => {
    setSelectedSeller('');
    setSelectedPaymentMethod('');
    setDateFilter('today');
  };

  const handlePrint = () => {
    const printContent = document.getElementById('sales-records-table');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Sales Records</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .print-date { text-align: right; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BAMBI STORE</h1>
            <h2>Daily Sales Records ${dateFilter === 'today' ? "(Today's Sales)" : "(All Records)"}</h2>
          </div>
          <div class="print-date">
            <p>Printed on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleAttachment = () => {
    const csvHeaders = ['Date', 'Time', 'Product', 'Quantity', 'Unit Price', 'Total Price', 'Customer', 'Seller', 'Payment Method'];
    const csvRows = filteredSalesRecords.map(record => [
      new Date(record.timestamp?.toDate?.() || record.timestamp).toLocaleDateString(),
      new Date(record.timestamp?.toDate?.() || record.timestamp).toLocaleTimeString(),
      record.productName,
      record.quantity,
      record.unitPrice,
      record.totalPrice,
      record.buyerName || 'Walk-in Customer',
      record.sellerName,
      record.paymentMethod || 'N/A'
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_sales_${dateFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: "Filtered sales records exported successfully!"
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = selectedSeller !== '' || selectedPaymentMethod !== '' || dateFilter !== 'today';

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col h-full">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Sales Records</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {dateFilter === 'today' ? "Showing today's sales records" : "Showing all-time sales records"}
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Printer size={16} className="mr-2" />
            Print
          </button>
          <button
            onClick={handleAttachment}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Paperclip size={16} className="mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg border dark:border-gray-700 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        {/* Date Filter */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center">
            <Calendar size={12} className="mr-1 text-blue-600" /> Date Scope
          </label>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'today' | 'all')}
            className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="today">Today's Sales Only</option>
            <option value="all">All Sales Records</option>
          </select>
        </div>

        {/* Filter by Seller */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center">
            <User size={12} className="mr-1 text-indigo-600" /> Filter by Seller
          </label>
          <select
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="">All Sellers</option>
            {uniqueSellers.map((seller) => (
              <option key={seller} value={seller}>
                {seller}
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Payment Method */}
        <div className="relative">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1 flex items-center">
            <CreditCard size={12} className="mr-1 text-emerald-600" /> Filter by Payment
          </label>
          <div className="flex gap-2">
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Payment Methods</option>
              {uniquePaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-white rounded-md text-xs flex items-center transition-colors flex-shrink-0"
                title="Reset Filters"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div id="sales-records-table" className="flex-1">
        <Table containerClassName="max-h-[500px] overflow-auto border rounded-md">
          <TableHeader className="sticky top-0 bg-white dark:bg-gray-800 z-10 shadow-sm">
            <TableRow>
              <TableHead className="bg-white dark:bg-gray-800">Date</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Product</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Quantity</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Unit Price</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Total Price</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Customer</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Seller</TableHead>
              <TableHead className="bg-white dark:bg-gray-800">Payment Method</TableHead>
              <TableHead className="bg-white dark:bg-gray-800 text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalesRecords.length > 0 ? (
              filteredSalesRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {new Date(record.timestamp?.toDate?.() || record.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{record.productName}</TableCell>
                  <TableCell>{record.quantity}</TableCell>
                  <TableCell>{formatCurrency(record.unitPrice)}</TableCell>
                  <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(record.totalPrice)}
                  </TableCell>
                  <TableCell>{record.buyerName || 'Walk-in Customer'}</TableCell>
                  <TableCell>{record.sellerName}</TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                      {record.paymentMethod || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => generateSaleReceipt({
                        productName: record.productName,
                        quantity: record.quantity,
                        unitPrice: record.unitPrice,
                        totalPrice: record.totalPrice,
                        buyerName: record.buyerName || 'Walk-in Customer',
                        sellerName: record.sellerName,
                        timestamp: record.timestamp,
                        paymentMethod: record.paymentMethod
                      }, userProfile)}
                      className="inline-flex items-center px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded text-xs font-medium transition-colors"
                      title="Download Receipt PDF"
                    >
                      <Download size={12} className="mr-1" />
                      PDF
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  No sales records found matching the active filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer */}
      {filteredSalesRecords.length > 0 && (
        <div className="mt-4 pt-3 border-t dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 flex flex-wrap justify-between items-center gap-2">
          <span>
            Showing <strong>{filteredSalesRecords.length}</strong> transaction(s)
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            Total Revenue: {formatCurrency(filteredSalesRecords.reduce((sum, record) => sum + record.totalPrice, 0))}
          </span>
        </div>
      )}
    </div>
  );
};

export default DailySalesRecords;

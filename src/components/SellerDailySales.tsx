import React, { useState, useEffect } from 'react';
import { Printer, Download, User } from 'lucide-react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { generateSaleReceipt } from './PDFGenerator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from "@/hooks/use-toast";

interface SaleRecord {
  id: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  buyerName: string;
  sellerName: string;
  timestamp: any;
  date: string;
}

interface SellerSummary {
  sellerName: string;
  totalSales: number;
  totalRevenue: number;
  salesCount: number;
  sales: SaleRecord[];
}

const SellerDailySales = () => {
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [sellerSummaries, setSellerSummaries] = useState<SellerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchSalesRecords();
  }, []);

  useEffect(() => {
    generateSellerSummaries();
  }, [salesRecords]);

  const fetchSalesRecords = async () => {
    try {
      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const salesQuery = query(
        collection(db, 'sales'),
        orderBy('timestamp', 'desc')
      );
      const salesSnapshot = await getDocs(salesQuery);
      
      // Filter for today's sales with proper typing
      const todaysSales = salesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as SaleRecord))
        .filter(sale => {
          const saleDate = sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date(sale.timestamp);
          return saleDate >= startOfDay && saleDate <= endOfDay;
        });

      setSalesRecords(todaysSales);
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

  const generateSellerSummaries = () => {
    const sellerMap = new Map<string, SellerSummary>();

    salesRecords.forEach(record => {
      const sellerName = record.sellerName || 'Unknown Seller';
      
      if (sellerMap.has(sellerName)) {
        const existing = sellerMap.get(sellerName)!;
        existing.totalSales += record.quantity;
        existing.totalRevenue += record.totalPrice;
        existing.salesCount += 1;
        existing.sales.push(record);
      } else {
        sellerMap.set(sellerName, {
          sellerName,
          totalSales: record.quantity,
          totalRevenue: record.totalPrice,
          salesCount: 1,
          sales: [record]
        });
      }
    });

    const summaries = Array.from(sellerMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    setSellerSummaries(summaries);
  };

  const handlePrintSeller = (sellerName: string) => {
    const seller = sellerSummaries.find(s => s.sellerName === sellerName);
    if (!seller) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const salesTableRows = seller.sales.map(sale => `
      <tr>
        <td>${new Date(sale.timestamp?.toDate?.() || sale.timestamp).toLocaleDateString()}</td>
        <td>${sale.productName}</td>
        <td>${sale.category || 'Uncategorized'}</td>
        <td>${sale.quantity}</td>
        <td>Br${sale.unitPrice.toFixed(2)}</td>
        <td>Br${sale.totalPrice.toFixed(2)}</td>
        <td>${sale.buyerName || 'Walk-in Customer'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Daily Sales Report - ${sellerName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; }
            .print-date { text-align: right; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BAMBI STORE</h1>
            <h2>Daily Sales Report</h2>
            <h3>Seller: ${sellerName}</h3>
          </div>
          <div class="print-date">
            <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>
          <div class="summary">
            <p><strong>Total Sales:</strong> ${seller.salesCount} transactions</p>
            <p><strong>Items Sold:</strong> ${seller.totalSales} items</p>
            <p><strong>Total Revenue:</strong> Br${seller.totalRevenue.toFixed(2)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
                <th>Customer</th>
              </tr>
            </thead>
            <tbody>
              ${salesTableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleExportSeller = (sellerName: string) => {
    const seller = sellerSummaries.find(s => s.sellerName === sellerName);
    if (!seller) return;

    const csvHeaders = ['Date', 'Product', 'Category', 'Quantity', 'Unit Price', 'Total Price', 'Customer'];
    const csvRows = seller.sales.map(sale => [
      new Date(sale.timestamp?.toDate?.() || sale.timestamp).toLocaleDateString(),
      sale.productName,
      sale.category || 'Uncategorized',
      sale.quantity,
      sale.unitPrice,
      sale.totalPrice,
      sale.buyerName || 'Walk-in Customer'
    ]);

    const csvContent = [
      `Daily Sales Report - ${sellerName}`,
      `Generated on: ${new Date().toLocaleDateString()}`,
      `Total Sales: ${seller.salesCount}, Items Sold: ${seller.totalSales}, Revenue: Br${seller.totalRevenue.toFixed(2)}`,
      '',
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_sales_${sellerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Success",
      description: `Sales report for ${sellerName} exported successfully!`
    });
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Daily Sales by Seller</h3>
        <div className="text-sm text-gray-600">
          {new Date().toLocaleDateString()} - Today's Sales
        </div>
      </div>

      {sellerSummaries.length > 0 ? (
        <div className="space-y-6">
          {sellerSummaries.map((seller) => (
            <div key={seller.sellerName} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-600" />
                  <h4 className="text-lg font-medium text-gray-900">{seller.sellerName}</h4>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePrintSeller(seller.sellerName)}
                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Printer size={14} className="mr-1" />
                    Print
                  </button>
                  <button
                    onClick={() => handleExportSeller(seller.sellerName)}
                    className="flex items-center px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    <Download size={14} className="mr-1" />
                    Export
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-gray-900">{seller.salesCount}</div>
                  <div className="text-gray-600">Sales</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-gray-900">{seller.totalSales}</div>
                  <div className="text-gray-600">Items Sold</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold text-gray-900">{formatCurrency(seller.totalRevenue)}</div>
                  <div className="text-gray-600">Revenue</div>
                </div>
              </div>

              <div>
                <Table containerClassName="max-h-[400px] overflow-auto border rounded-md">
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="bg-white">Time</TableHead>
                      <TableHead className="bg-white">Product</TableHead>
                      <TableHead className="bg-white">Category</TableHead>
                      <TableHead className="bg-white">Qty</TableHead>
                      <TableHead className="bg-white">Unit Price</TableHead>
                      <TableHead className="bg-white">Total</TableHead>
                      <TableHead className="bg-white">Customer</TableHead>
                      <TableHead className="bg-white text-right">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seller.sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          {new Date(sale.timestamp?.toDate?.() || sale.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-medium">{sale.productName}</TableCell>
                        <TableCell>{sale.category || 'Uncategorized'}</TableCell>
                        <TableCell>{sale.quantity}</TableCell>
                        <TableCell>{formatCurrency(sale.unitPrice)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(sale.totalPrice)}</TableCell>
                        <TableCell>{sale.buyerName || 'Walk-in Customer'}</TableCell>
                        <TableCell className="text-right">
                          <button
                            onClick={() => generateSaleReceipt({
                              productName: sale.productName,
                              quantity: sale.quantity,
                              unitPrice: sale.unitPrice,
                              totalPrice: sale.totalPrice,
                              buyerName: sale.buyerName || 'Walk-in Customer',
                              sellerName: sale.sellerName,
                              timestamp: sale.timestamp
                            }, userProfile)}
                            className="inline-flex items-center px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-medium transition-colors"
                            title="Download Receipt PDF"
                          >
                            <Download size={12} className="mr-1" />
                            PDF
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No sales recorded today</p>
        </div>
      )}
    </div>
  );
};

export default SellerDailySales;

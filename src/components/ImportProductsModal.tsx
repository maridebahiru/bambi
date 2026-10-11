import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsImported: () => void;
}

interface ParsedProductRow {
  code: string;
  name: string;
  category: string;
  purchasePrice: number;
  interestPercent: number;
  stock: number;
  supplierName?: string;
  invoiceNumber?: string;
  isValid: boolean;
  error?: string;
}

const ImportProductsModal: React.FC<ImportProductsModalProps> = ({ isOpen, onClose, onProductsImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const downloadTemplate = (e?: React.MouseEvent) => {
    try {
      // Direct link fallback
      const link = document.createElement('a');
      link.href = '/product_import_template.xlsx';
      link.setAttribute('download', 'product_import_template.xlsx');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 300);

      toast({
        title: "Excel Template Downloaded",
        description: "product_import_template.xlsx downloaded successfully."
      });
    } catch (error) {
      console.error("Direct template download error, generating dynamically:", error);

      try {
        const templateData = [
          {
            "Code": "PRD-1001",
            "Name": "Wireless Charger 15W",
            "Category": "Chargers",
            "Purchase Price": 250,
            "Interest Percent": 30,
            "Stock": 15,
            "Supplier Name": "Anker Wholesale",
            "Invoice Number": "INV-8821"
          },
          {
            "Code": "PRD-1002",
            "Name": "Silicone Phone Case",
            "Category": "Covers",
            "Purchase Price": 120,
            "Interest Percent": 40,
            "Stock": 50,
            "Supplier Name": "Global Accessories",
            "Invoice Number": "INV-8822"
          }
        ];

        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

        worksheet['!cols'] = [
          { wch: 15 },
          { wch: 30 },
          { wch: 20 },
          { wch: 18 },
          { wch: 18 },
          { wch: 12 },
          { wch: 25 },
          { wch: 18 }
        ];

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.setAttribute('download', 'product_import_template.xlsx');
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          window.URL.revokeObjectURL(url);
        }, 200);

        toast({
          title: "Excel Template Downloaded",
          description: "product_import_template.xlsx downloaded."
        });
      } catch (fallbackErr: any) {
        console.error("Dynamic XLSX generation error:", fallbackErr);
        toast({
          title: "Download Error",
          description: fallbackErr?.message || "Could not generate Excel file.",
          variant: "destructive"
        });
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        const processedRows: ParsedProductRow[] = rawJson.map((row, idx) => {
          // Flexible key lookup
          const codeRaw = (row["Code"] || row["Product Code"] || row["SKU"] || row["code"] || "").toString().trim();
          const nameRaw = (row["Name"] || row["Product Name"] || row["name"] || "").toString().trim();
          const categoryRaw = (row["Category"] || row["category"] || "").toString().trim();
          
          const pPriceRaw = parseFloat(row["Purchase Price"] || row["PurchasePrice"] || row["Cost"] || row["purchasePrice"] || 0);
          const interestRaw = parseFloat(row["Interest Percent"] || row["InterestPercent"] || row["Interest %"] || row["Margin %"] || row["interestPercent"] || 0);
          const stockRaw = parseInt(row["Stock"] || row["stock"] || row["Quantity"] || row["Qty"] || 0, 10);
          
          const supplierName = (row["Supplier Name"] || row["Supplier"] || row["supplierName"] || "").toString().trim();
          const invoiceNumber = (row["Invoice Number"] || row["Invoice #"] || row["invoiceNumber"] || "").toString().trim();

          let isValid = true;
          let error = "";

          if (!codeRaw) {
            isValid = false;
            error = "Missing Product Code / SKU";
          } else if (!nameRaw) {
            isValid = false;
            error = "Missing Product Name";
          } else if (!categoryRaw) {
            isValid = false;
            error = "Missing Category";
          } else if (isNaN(pPriceRaw) || pPriceRaw <= 0) {
            isValid = false;
            error = "Invalid Purchase Price (> 0 required)";
          } else if (isNaN(stockRaw) || stockRaw < 0) {
            isValid = false;
            error = "Invalid Stock (>= 0 required)";
          }

          return {
            code: codeRaw,
            name: nameRaw,
            category: categoryRaw,
            purchasePrice: isNaN(pPriceRaw) ? 0 : pPriceRaw,
            interestPercent: isNaN(interestRaw) ? 0 : interestRaw,
            stock: isNaN(stockRaw) ? 0 : stockRaw,
            supplierName,
            invoiceNumber,
            isValid,
            error
          };
        });

        setParsedRows(processedRows);
      } catch (err) {
        console.error("Error reading file:", err);
        toast({
          title: "File Parse Error",
          description: "Could not parse Excel/CSV file. Please ensure valid file format.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast({
        title: "No Valid Products",
        description: "Please fix invalid rows or upload a valid Excel file.",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    let successCount = 0;

    try {
      for (const row of validRows) {
        const sellingPrice = row.purchasePrice + (row.purchasePrice * (row.interestPercent || 0) / 100);

        const productRef = await addDoc(collection(db, 'products'), {
          code: row.code,
          name: row.name,
          category: row.category,
          purchasePrice: row.purchasePrice,
          interestPercent: row.interestPercent,
          price: sellingPrice,
          stock: row.stock,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Create Accounts Payable if stock > 0
        if (row.stock > 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);

          await addDoc(collection(db, 'payables'), {
            supplierName: row.supplierName || 'Excel Import Supplier',
            invoiceNumber: row.invoiceNumber || `IMP-${Date.now().toString().slice(-6)}`,
            amountOwed: row.purchasePrice * row.stock,
            dueDate: dueDate.toISOString().split('T')[0],
            status: 'Unpaid',
            productId: productRef.id,
            productName: row.name,
            quantityAdded: row.stock,
            unitCost: row.purchasePrice,
            createdAt: new Date(),
            paidAt: null
          });
        }

        successCount++;
      }

      toast({
        title: "Import Successful",
        description: `Successfully imported ${successCount} product(s) into inventory.`
      });

      onProductsImported();
      onClose();
    } catch (err) {
      console.error("Error importing products:", err);
      toast({
        title: "Import Error",
        description: "An error occurred while saving imported products to database.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="text-green-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Import Products from Excel / CSV</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Upload Controls & Template Download */}
        <div className="my-4 p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-emerald-950 dark:text-emerald-200">1. Download Sample Excel Template (.xlsx)</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Get an official pre-formatted Excel file with standard headers and sample data.</p>
          </div>
          <a
            href="/product_import_template.xlsx"
            download="product_import_template.xlsx"
            onClick={() => {
              toast({
                title: "Excel Template Downloaded",
                description: "product_import_template.xlsx saved to downloads."
              });
            }}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-colors flex-shrink-0 cursor-pointer"
          >
            <Download size={16} />
            <span>Download Excel Template (.xlsx)</span>
          </a>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">2. Upload Excel / CSV File</label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
        </div>

        {/* Status Banner */}
        {parsedRows.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs font-medium">
              <span className="text-blue-900">Total Rows: {parsedRows.length}</span>
              <span className="text-green-700 flex items-center"><CheckCircle size={14} className="mr-1" /> Valid: {validCount}</span>
              {invalidCount > 0 && (
                <span className="text-red-600 flex items-center"><AlertTriangle size={14} className="mr-1" /> Invalid: {invalidCount}</span>
              )}
            </div>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <div className="flex-1 overflow-x-auto border rounded-lg max-h-60 mb-4">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="bg-gray-100 sticky top-0 text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="px-3 py-2 border-b">Status</th>
                  <th className="px-3 py-2 border-b">Code</th>
                  <th className="px-3 py-2 border-b">Name</th>
                  <th className="px-3 py-2 border-b">Category</th>
                  <th className="px-3 py-2 border-b">Cost (birr)</th>
                  <th className="px-3 py-2 border-b">Margin %</th>
                  <th className="px-3 py-2 border-b">Selling Price</th>
                  <th className="px-3 py-2 border-b">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parsedRows.map((row, idx) => {
                  const sellingPrice = row.purchasePrice + (row.purchasePrice * (row.interestPercent || 0) / 100);
                  return (
                    <tr key={idx} className={row.isValid ? "hover:bg-gray-50" : "bg-red-50"}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.isValid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-medium">Valid</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-medium">{row.error}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-900">{row.code}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{row.name || "-"}</td>
                      <td className="px-3 py-2">{row.category || "-"}</td>
                      <td className="px-3 py-2">birr {row.purchasePrice.toFixed(2)}</td>
                      <td className="px-3 py-2">{row.interestPercent}%</td>
                      <td className="px-3 py-2 font-medium text-gray-900">birr {sellingPrice.toFixed(2)}</td>
                      <td className="px-3 py-2">{row.stock}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end space-x-3 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="px-5 py-2 text-sm bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            <Upload size={16} />
            <span>{importing ? "Importing Products..." : `Import ${validCount} Products`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportProductsModal;

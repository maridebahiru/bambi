import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, Clock, AlertTriangle, Plus, Trash2, Calendar, FileText } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface PayableDoc {
  id: string;
  supplierName: string;
  invoiceNumber: string;
  amountOwed: number;
  dueDate: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  productName?: string;
  quantityAdded?: number;
  createdAt?: any;
  paidAt?: any;
}

const AccountsPayable: React.FC = () => {
  const [payables, setPayables] = useState<PayableDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPayable, setNewPayable] = useState({
    supplierName: '',
    invoiceNumber: '',
    amountOwed: 0,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchPayables();
  }, []);

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'payables'));
      const todayStr = new Date().toISOString().split('T')[0];

      const list = snap.docs.map(d => {
        const data = d.data();
        let status = data.status || 'Unpaid';
        if (status === 'Unpaid' && data.dueDate && data.dueDate < todayStr) {
          status = 'Overdue';
        }
        return { id: d.id, ...data, status } as PayableDoc;
      });

      setPayables(list);
    } catch (e) {
      console.error('Error fetching payables:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (payableId: string) => {
    try {
      await updateDoc(doc(db, 'payables', payableId), {
        status: 'Paid',
        paidAt: new Date(),
      });
      setPayables(payables.map(p => p.id === payableId ? { ...p, status: 'Paid', paidAt: new Date() } : p));
      toast({
        title: "Payable Updated",
        description: "Marked bill as Paid!",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to update payable.",
        variant: "destructive"
      });
    }
  };

  const handleDeletePayable = async (payableId: string) => {
    if (confirm('Delete this accounts payable record?')) {
      try {
        await deleteDoc(doc(db, 'payables', payableId));
        setPayables(payables.filter(p => p.id !== payableId));
        toast({
          title: "Deleted",
          description: "Payable record removed.",
        });
      } catch (e) {
        console.error('Error deleting payable:', e);
      }
    }
  };

  const handleAddPayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayable.supplierName || newPayable.amountOwed <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in supplier name and valid amount.",
        variant: "destructive"
      });
      return;
    }

    try {
      await addDoc(collection(db, 'payables'), {
        supplierName: newPayable.supplierName.trim(),
        invoiceNumber: newPayable.invoiceNumber.trim() || `BILL-${Date.now().toString().slice(-6)}`,
        amountOwed: newPayable.amountOwed,
        dueDate: newPayable.dueDate,
        status: 'Unpaid',
        createdAt: new Date(),
        paidAt: null
      });

      setIsAddModalOpen(false);
      setNewPayable({
        supplierName: '',
        invoiceNumber: '',
        amountOwed: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      fetchPayables();
      toast({
        title: "Success",
        description: "New Accounts Payable bill created!",
      });
    } catch (e) {
      console.error('Error creating payable:', e);
    }
  };

  // Aging Summary Calculation
  const today = new Date();

  let bucket0To30 = 0;
  let bucket31To60 = 0;
  let bucket60Plus = 0;

  const unpaidPayables = payables.filter(p => p.status !== 'Paid');
  const totalOwed = unpaidPayables.reduce((sum, p) => sum + p.amountOwed, 0);

  unpaidPayables.forEach(p => {
    const due = new Date(p.dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

    if (diffDays <= 30) {
      bucket0To30 += p.amountOwed;
    } else if (diffDays <= 60) {
      bucket31To60 += p.amountOwed;
    } else {
      bucket60Plus += p.amountOwed;
    }
  });

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Accounts Payable (Supplier Bills)</h3>
          <p className="text-xs text-gray-500">Track supplier invoices and stock restock liabilities</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          <Plus size={16} className="mr-1.5" />
          Add Supplier Bill
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Outstanding Owed</p>
          <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">Br {totalOwed.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-1">{unpaidPayables.length} Unpaid Bills</p>
        </div>

        {/* Aging Buckets */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">Current (0 - 30 Days)</p>
          <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">Br {bucket0To30.toFixed(2)}</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Due within 30 days</p>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/30 p-5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase">Aging (31 - 60 Days)</p>
          <h3 className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1">Br {bucket31To60.toFixed(2)}</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">31-60 days overdue</p>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/30 p-5 rounded-lg border border-rose-200 dark:border-rose-900/50 shadow-sm">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Critical (60+ Days Overdue)</p>
          <h3 className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-1">Br {bucket60Plus.toFixed(2)}</h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">&gt; 60 days overdue</p>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Supplier</th>
                <th className="px-6 py-3 text-left">Invoice #</th>
                <th className="px-6 py-3 text-left">Restock Details</th>
                <th className="px-6 py-3 text-right">Amount Owed</th>
                <th className="px-6 py-3 text-center">Due Date</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {payables.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center">
                    <Truck size={16} className="mr-2 text-indigo-600" />
                    {p.supplierName}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{p.invoiceNumber}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-xs">
                    {p.productName ? `${p.productName} (+${p.quantityAdded} units)` : 'Manual Expense / Bill'}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">
                    Br {p.amountOwed.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 text-xs">{p.dueDate}</td>
                  <td className="px-6 py-4 text-center">
                    {p.status === 'Paid' ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Paid
                      </span>
                    ) : p.status === 'Overdue' ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                        Overdue
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Unpaid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {p.status !== 'Paid' && (
                        <button
                          onClick={() => handleMarkAsPaid(p.id)}
                          className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePayable(p.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payables.length === 0 && (
          <div className="text-center py-8 text-gray-500">No accounts payable records found.</div>
        )}
      </div>

      {/* Add Payable Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Supplier Bill (Payable)</h3>
            <form onSubmit={handleAddPayable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  value={newPayable.supplierName}
                  onChange={(e) => setNewPayable({ ...newPayable, supplierName: e.target.value })}
                  placeholder="e.g. Samsung Direct Trading"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Invoice / Bill Number</label>
                <input
                  type="text"
                  value={newPayable.invoiceNumber}
                  onChange={(e) => setNewPayable({ ...newPayable, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-99823"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Owed (birr) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPayable.amountOwed || ''}
                  onChange={(e) => setNewPayable({ ...newPayable, amountOwed: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Due Date *</label>
                <input
                  type="date"
                  value={newPayable.dueDate}
                  onChange={(e) => setNewPayable({ ...newPayable, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 text-gray-700 dark:text-gray-300 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Create Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPayable;

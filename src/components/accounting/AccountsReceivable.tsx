import React, { useState, useEffect } from 'react';
import { UserCheck, DollarSign, Clock, AlertTriangle, Plus, Trash2, Calendar, Phone, CheckCircle, CreditCard } from 'lucide-react';
import { collection, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface PaymentHistoryEntry {
  amount: number;
  paymentMethod: string;
  date: string;
  notes?: string;
}

interface ReceivableDoc {
  id: string;
  customerName: string;
  customerPhone: string;
  productNames?: string;
  totalAmount: number;
  amountPaid: number;
  balanceRemaining: number;
  dueDate: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue';
  createdAt?: any;
  lastPaymentDate?: any;
  paymentHistory?: PaymentHistoryEntry[];
}

const AccountsReceivable: React.FC = () => {
  const [receivables, setReceivables] = useState<ReceivableDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableDoc | null>(null);

  // Payment Recording Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchReceivables();
  }, []);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'receivables'));
      const todayStr = new Date().toISOString().split('T')[0];

      const list = snap.docs.map(d => {
        const data = d.data();
        const paid = data.amountPaid || 0;
        const total = data.totalAmount || 0;
        const balance = Math.max(0, total - paid);

        let status = data.status || 'Unpaid';
        if (balance <= 0) {
          status = 'Paid';
        } else if (data.dueDate && data.dueDate < todayStr) {
          status = 'Overdue';
        } else if (paid > 0) {
          status = 'Partially Paid';
        }

        return {
          id: d.id,
          ...data,
          amountPaid: paid,
          balanceRemaining: balance,
          status,
        } as ReceivableDoc;
      });

      setReceivables(list.sort((a, b) => b.balanceRemaining - a.balanceRemaining));
    } catch (e) {
      console.error('Error fetching receivables:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentModal = (item: ReceivableDoc) => {
    setSelectedReceivable(item);
    setPaymentAmount(item.balanceRemaining);
    setPaymentMethod('Cash');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable || paymentAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid payment amount.",
        variant: "destructive"
      });
      return;
    }

    setSavingPayment(true);
    try {
      const newAmountPaid = selectedReceivable.amountPaid + paymentAmount;
      const newBalance = Math.max(0, selectedReceivable.totalAmount - newAmountPaid);
      const todayStr = new Date().toISOString().split('T')[0];
      const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

      const newHistoryEntry: PaymentHistoryEntry = {
        amount: paymentAmount,
        paymentMethod,
        date: todayStr,
        notes: paymentNotes.trim() || undefined,
      };

      const existingHistory = selectedReceivable.paymentHistory || [];
      const updatedHistory = [...existingHistory, newHistoryEntry];

      await updateDoc(doc(db, 'receivables', selectedReceivable.id), {
        amountPaid: newAmountPaid,
        balanceRemaining: newBalance,
        status: newStatus,
        lastPaymentDate: new Date(),
        paymentHistory: updatedHistory,
      });

      setIsPaymentModalOpen(false);
      setSelectedReceivable(null);
      fetchReceivables();

      toast({
        title: "Payment Recorded",
        description: `Br ${paymentAmount.toFixed(2)} received from ${selectedReceivable.customerName}!`,
      });
    } catch (e) {
      console.error('Error recording payment:', e);
      toast({
        title: "Error",
        description: "Failed to record payment.",
        variant: "destructive"
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeleteReceivable = async (id: string) => {
    if (confirm('Are you sure you want to delete this credit receivable record?')) {
      try {
        await deleteDoc(doc(db, 'receivables', id));
        setReceivables(receivables.filter(r => r.id !== id));
        toast({ title: "Deleted", description: "Credit record deleted." });
      } catch (e) {
        console.error('Error deleting receivable:', e);
      }
    }
  };

  // Aging Summary Calculation
  const today = new Date();
  let bucket0To30 = 0;
  let bucket31To60 = 0;
  let bucket60Plus = 0;

  const unpaidItems = receivables.filter(r => r.balanceRemaining > 0);
  const totalOutstanding = unpaidItems.reduce((sum, r) => sum + r.balanceRemaining, 0);
  const totalCollected = receivables.reduce((sum, r) => sum + r.amountPaid, 0);

  unpaidItems.forEach(r => {
    const due = new Date(r.dueDate);
    const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));

    if (diffDays <= 30) {
      bucket0To30 += r.balanceRemaining;
    } else if (diffDays <= 60) {
      bucket31To60 += r.balanceRemaining;
    } else {
      bucket60Plus += r.balanceRemaining;
    }
  });

  const filteredList = receivables.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.customerPhone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Accounts Receivable (Customer Credit & Loans)</h3>
          <p className="text-xs text-gray-500">Track customer credit debts, partial payments, and overdue balances</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Outstanding Receivables</p>
          <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">Br {totalOutstanding.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-1">{unpaidItems.length} Unpaid Customer Debts</p>
        </div>

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

      {/* Search Input */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <input
          type="text"
          placeholder="Search credit customers by name or phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
        />
      </div>

      {/* Receivables Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Customer Name</th>
                <th className="px-6 py-3 text-left">Phone Number</th>
                <th className="px-6 py-3 text-left">Items Purchased</th>
                <th className="px-6 py-3 text-right">Total Sale</th>
                <th className="px-6 py-3 text-right">Amount Paid</th>
                <th className="px-6 py-3 text-right">Balance Due</th>
                <th className="px-6 py-3 text-center">Due Date</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredList.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center">
                    <UserCheck size={16} className="mr-2 text-indigo-600" />
                    {r.customerName}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-xs font-mono">
                    <span className="inline-flex items-center">
                      <Phone size={12} className="mr-1 text-gray-400" />
                      {r.customerPhone}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-xs max-w-xs truncate">
                    {r.productNames || 'Electronics Purchase'}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">
                    Br {r.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    Br {r.amountPaid.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-amber-600 dark:text-amber-400">
                    Br {r.balanceRemaining.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 text-xs">{r.dueDate}</td>
                  <td className="px-6 py-4 text-center">
                    {r.status === 'Paid' ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Paid
                      </span>
                    ) : r.status === 'Overdue' ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                        Overdue
                      </span>
                    ) : r.status === 'Partially Paid' ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Partial
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Unpaid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {r.balanceRemaining > 0 && (
                        <button
                          onClick={() => handleOpenPaymentModal(r)}
                          className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium transition-colors"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteReceivable(r.id)}
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

        {filteredList.length === 0 && (
          <div className="text-center py-8 text-gray-500">No customer credit receivables found.</div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && selectedReceivable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Record Customer Debt Payment</h3>
            <p className="text-xs text-gray-500 mb-4">
              Customer: <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedReceivable.customerName}</span> ({selectedReceivable.customerPhone})
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-750 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Sale Amount:</span>
                  <span className="font-semibold">Br {selectedReceivable.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Already Paid:</span>
                  <span className="font-semibold text-emerald-600">Br {selectedReceivable.amountPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-600 pt-1 border-t dark:border-gray-700">
                  <span>Current Balance Remaining:</span>
                  <span>Br {selectedReceivable.balanceRemaining.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Received Amount (birr) *</label>
                <input
                  type="number"
                  min="0.01"
                  max={selectedReceivable.balanceRemaining}
                  step="0.01"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="CBE Mobile Banking">CBE Mobile Banking</option>
                  <option value="Telebirr">Telebirr</option>
                  <option value="Amhara Bank">Amhara Bank</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Other Bank">Other Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notes / Payment Reference</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Telebirr Txn # 881274"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2 text-gray-700 dark:text-gray-300 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  {savingPayment ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsReceivable;

import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Trash2, Calendar, Tag, DollarSign } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ExpenseDoc {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdBy?: string;
  createdAt?: any;
}

const ExpensesManager: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    category: 'Rent',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const { userProfile } = useAuth();
  const { toast } = useToast();

  const expenseCategories = ['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'expenses'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ExpenseDoc[];
      setExpenses(list.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || formData.amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a description and valid amount.",
        variant: "destructive"
      });
      return;
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        description: formData.description.trim(),
        category: formData.category,
        amount: formData.amount,
        date: formData.date,
        createdBy: userProfile?.name || 'Admin',
        createdAt: new Date(),
      });

      setIsAddOpen(false);
      setFormData({
        description: '',
        category: 'Rent',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
      });
      fetchExpenses();
      toast({
        title: "Expense Logged",
        description: "Operating expense recorded successfully!",
      });
    } catch (e) {
      console.error('Error logging expense:', e);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Delete this expense entry?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        setExpenses(expenses.filter(e => e.id !== id));
        toast({ title: "Deleted", description: "Expense entry deleted." });
      } catch (e) {
        console.error('Error deleting expense:', e);
      }
    }
  };

  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Operating Expenses Tracker</h3>
          <p className="text-xs text-gray-500">Log shop rent, utilities, salaries, and operating costs</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
        >
          <Plus size={16} className="mr-1.5" />
          Log New Expense
        </button>
      </div>

      {/* Total Card */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Logged Operating Expenses</p>
          <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">Br {totalExpensesAmount.toFixed(2)}</h3>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg">
          <Receipt size={22} />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Description</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-center">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{e.description}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 text-xs">{e.date}</td>
                  <td className="px-6 py-4 text-right font-bold text-red-600 dark:text-red-400">
                    Br {e.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleDeleteExpense(e.id)} className="p-1 text-red-600 hover:text-red-800">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {expenses.length === 0 && (
          <div className="text-center py-8 text-gray-500">No operating expenses logged yet.</div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Log Operating Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Shop Rent for August"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (birr) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expense Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="flex-1 py-2 text-gray-700 dark:text-gray-300 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesManager;

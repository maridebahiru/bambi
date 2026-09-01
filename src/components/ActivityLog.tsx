import React, { useState, useEffect } from 'react';
import { Activity, Search, Calendar, User, Filter, ShieldCheck, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ActivityLogItem } from '../lib/activityLogger';

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let snap;
      try {
        const q = query(collection(db, 'activity_log'), orderBy('timestamp', 'desc'), limit(300));
        snap = await getDocs(q);
      } catch (queryErr) {
        snap = await getDocs(collection(db, 'activity_log'));
      }
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLogItem[];
      list.sort((a, b) => {
        const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.date ? new Date(a.date).getTime() : 0);
        const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.date ? new Date(b.date).getTime() : 0);
        return tB - tA;
      });
      setLogs(list);
    } catch (e) {
      console.error('Error loading activity logs:', e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getLogDateString = (item: ActivityLogItem) => {
    if (item.timestamp?.toDate) {
      const d = item.timestamp.toDate();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (item.date) return item.date;
    return new Date().toISOString().split('T')[0];
  };

  const formatLogTimestamp = (item: ActivityLogItem) => {
    if (item.timestamp?.toDate) {
      return item.timestamp.toDate().toLocaleString();
    }
    return item.date || 'Unknown';
  };

  const renderSafeText = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      try {
        return Object.entries(val)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
      } catch (e) {
        return JSON.stringify(val);
      }
    }
    return String(val);
  };

  const filteredLogs = logs.filter(log => {
    const logDate = getLogDateString(log);
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;

    if (actionFilter !== 'ALL' && log.action !== actionFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDetails = renderSafeText(log.details).toLowerCase().includes(term);
      const matchUser = renderSafeText(log.userName).toLowerCase().includes(term);
      const matchAction = renderSafeText(log.action).toLowerCase().includes(term);
      return matchDetails || matchUser || matchAction;
    }

    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">Login</span>;
      case 'LOGOUT':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-200">Logout</span>;
      case 'CREATE_SALE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">Sale Processed</span>;
      case 'EDIT_PRICE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">Price Override</span>;
      case 'ADD_EXPENSE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">Expense Logged</span>;
      case 'ADD_USER':
      case 'EDIT_USER':
      case 'DELETE_USER':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200">User Account</span>;
      case 'SYSTEM_BACKUP':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200">Auto Backup</span>;
      case 'SYSTEM_RESTORE':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200">Data Restore</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200">{action}</span>;
    }
  };

  const totalSalesCount = logs.filter(l => l.action === 'CREATE_SALE').length;
  const totalPriceEdits = logs.filter(l => l.action === 'EDIT_PRICE').length;
  const totalExpensesLogged = logs.filter(l => l.action === 'ADD_EXPENSE').length;

  return (
    <div className="space-y-6">
      {/* Header & Activity Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="text-blue-600" size={24} />
            System Activity & Audit Log
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Real-time security audit trail tracking user logins, sales, price edits, expenses, and system actions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 w-fit"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Activities Recorded</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{logs.length}</h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Sales Completed</p>
          <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalSalesCount}</h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Price Modifications</p>
          <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totalPriceEdits}</h3>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Expenses Logged</p>
          <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{totalExpensesLogged}</h3>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search user, action or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <Filter size={14} className="text-gray-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
            >
              <option value="ALL">All Event Types</option>
              <option value="LOGIN">User Logins</option>
              <option value="CREATE_SALE">Sales</option>
              <option value="EDIT_PRICE">Price Modifications</option>
              <option value="ADD_EXPENSE">Expenses Logged</option>
              <option value="ADD_USER">User Account Creation</option>
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-gray-500 font-medium">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-700 dark:text-white"
          />
          <span className="text-gray-500 font-medium">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-750 text-gray-500 dark:text-gray-400 uppercase font-semibold border-b dark:border-gray-700">
              <tr>
                <th className="px-6 py-3.5 text-left">Timestamp</th>
                <th className="px-6 py-3.5 text-left">User</th>
                <th className="px-6 py-3.5 text-center">Event Type</th>
                <th className="px-6 py-3.5 text-left">Action Description & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/50 transition-colors">
                  <td className="px-6 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                    <div className="flex items-center space-x-1.5">
                      <Clock size={12} className="text-gray-400" />
                      <span>{formatLogTimestamp(log)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center space-x-1.5">
                      <User size={13} className="text-blue-500" />
                      <span>{renderSafeText(log.userName) || 'System'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-center whitespace-nowrap">
                    {getActionBadge(typeof log.action === 'string' ? log.action : 'EVENT')}
                  </td>
                  <td className="px-6 py-3.5 text-gray-700 dark:text-gray-300 font-medium">
                    {renderSafeText(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No activity logs found matching your filters.
          </div>
        )}

        {loading && (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            Loading activity log history...
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;

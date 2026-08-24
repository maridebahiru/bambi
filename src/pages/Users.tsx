import React, { useState } from 'react';
import { Users as UsersIcon, Activity } from 'lucide-react';
import UserManagement from '../components/UserManagement';
import ActivityLog from '../components/ActivityLog';

type UserTab = 'accounts' | 'activity';

const Users = () => {
  const [activeTab, setActiveTab] = useState<UserTab>('accounts');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management & System Security</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm">
          Manage system user accounts, roles, and review the real-time activity audit trail.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl shadow-sm px-4 pt-2">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <UsersIcon size={18} />
            <span>User Accounts</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center space-x-2 py-3 px-4 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Activity size={18} />
            <span>Activity Audit Log</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'accounts' && <UserManagement />}
        {activeTab === 'activity' && <ActivityLog />}
      </div>
    </div>
  );
};

export default Users;

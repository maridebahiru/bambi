import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  User,
  Receipt,
  Database,
  Calculator,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  userRole?: 'admin' | 'seller' | string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole, isCollapsed, onToggleCollapse }) => {
  const location = useLocation();
  const { logout, userProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const adminMenuItems = [
    { icon: Database, label: t('dashboard'), path: '/' },
    { icon: Package, label: t('products'), path: '/products' },
    { icon: ShoppingCart, label: t('sales'), path: '/sales' },
    { icon: Calculator, label: t('accounting'), path: '/accounting' },
    { icon: Receipt, label: t('reports'), path: '/reports' },
    { icon: Users, label: t('users'), path: '/users' },
    { icon: Settings, label: t('settings'), path: '/settings' },
  ];

  const sellerMenuItems = [
    { icon: ShoppingCart, label: t('sales'), path: '/sales' },
  ];

  const menuItems = (userRole === 'seller' || userRole === 'temporary') ? sellerMenuItems : adminMenuItems;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-slate-900 text-white rounded-lg shadow-md"
        aria-label="Toggle mobile menu"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-slate-900 text-white min-h-screen fixed top-0 left-0 z-40 transition-all duration-300 ease-in-out flex flex-col justify-between p-4 shadow-xl
          ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        <div>
          {/* Header & Toggle Button */}
          <div className="flex items-center justify-between mb-8 mt-12 lg:mt-2">
            {!isCollapsed ? (
              <div className="overflow-hidden">
                <h1 className="text-xl font-bold truncate">Shop Management</h1>
                <p className="text-slate-400 text-xs truncate">Store System</p>
              </div>
            ) : (
              <div className="mx-auto font-bold text-lg text-blue-500 hidden lg:block">SM</div>
            )}

            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          
          {/* Navigation Menu */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMobileMenu}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center ${isCollapsed ? 'lg:justify-center px-3' : 'px-4'} py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  {!isCollapsed && <span className="ml-3 text-sm font-medium truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
          {/* Language Switcher Toggle */}
          <div
            title={isCollapsed ? (language === 'en' ? 'English' : 'አማርኛ') : undefined}
            className={`flex items-center justify-between bg-slate-800 rounded-lg ${isCollapsed ? 'lg:justify-center p-2.5' : 'px-3 py-2'}`}
          >
            {!isCollapsed ? (
              <>
                <div className="flex items-center space-x-2 text-xs text-slate-300">
                  <Globe size={16} className="text-blue-400" />
                  <span>{t('language')}:</span>
                </div>
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                      language === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('am')}
                    className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
                      language === 'am' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    አማርኛ
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'am' : 'en')}
                className="text-xs font-bold text-blue-400 hover:text-white"
              >
                {language === 'en' ? 'EN' : 'አማ'}
              </button>
            )}
          </div>

          <button
            onClick={handleLogout}
            title={isCollapsed ? t('logout') : undefined}
            className={`w-full flex items-center ${isCollapsed ? 'lg:justify-center px-3' : 'px-4'} py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors`}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 text-sm font-medium">{t('logout')}</span>}
          </button>
          
          <div
            title={isCollapsed ? `${userProfile?.name || 'User'} (${userProfile?.role || 'Staff'})` : undefined}
            className={`flex items-center ${isCollapsed ? 'lg:justify-center p-2.5' : 'px-4 py-2.5'} bg-slate-800 rounded-lg`}
          >
            <User size={20} className="text-slate-400 flex-shrink-0" />
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium truncate text-white">{userProfile?.name || 'User'}</p>
                <p className="text-xs text-slate-400 capitalize truncate">{userProfile?.role || 'Staff'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

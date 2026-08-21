
import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Accounting from "./pages/Accounting";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Create QueryClient outside of component to avoid recreation on each render
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next.toString());
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar
          userRole={userProfile.role}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main
          className={`flex-1 p-4 sm:p-6 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
        >
          <Routes>
            <Route 
              path="/" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Home />} 
            />
            <Route 
              path="/dashboard" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Dashboard />} 
            />
            <Route 
              path="/products" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Products />} 
            />
            <Route path="/sales" element={<Sales />} />
            <Route 
              path="/accounting" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Accounting />} 
            />
            <Route 
              path="/reports" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Reports />} 
            />
            <Route 
              path="/users" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Users />} 
            />
            <Route 
              path="/settings" 
              element={userProfile.role === 'seller' ? <Navigate to="/sales" replace /> : <Settings />} 
            />
            <Route path="/receipts" element={<div className="text-center py-12"><h1 className="text-2xl font-bold dark:text-white">Receipts</h1><p className="text-gray-600 dark:text-gray-300 mt-2">Sales receipt management system.</p></div>} />
            <Route path="*" element={<Navigate to={userProfile.role === 'seller' ? "/sales" : "/"} replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <AppContent />
              <Toaster />
              <Sonner />
            </CurrencyProvider>
          </LanguageProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

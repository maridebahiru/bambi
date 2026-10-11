import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCategories } from '../lib/categoryService';

interface CategoryContextType {
  categories: string[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshCategories = useCallback(async () => {
    try {
      const cats = await getCategories();
      const sorted = [...cats].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      setCategories(sorted);
    } catch (error) {
      console.error('Error refreshing categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    refreshCategories();

    // Real-time listener: automatically updates when categories collection changes in Firestore
    const unsubscribe = onSnapshot(
      collection(db, 'categories'),
      () => {
        refreshCategories();
      },
      (error) => {
        console.error('Categories real-time snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [refreshCategories]);

  return (
    <CategoryContext.Provider value={{ categories, loading, refreshCategories }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = (): CategoryContextType => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
};

import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_CATEGORIES: string[] = [];

export interface CategoryItem {
  id?: string;
  name: string;
}

export const getCategories = async (): Promise<string[]> => {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const firestoreCategories = snap.docs.map(d => ((d.data().name as string) || '').trim()).filter(Boolean);
    
    // Also merge existing categories from products so no active product category is lost
    const productsSnap = await getDocs(collection(db, 'products'));
    const productCategories = productsSnap.docs.map(d => ((d.data().category as string) || '').trim()).filter(Boolean);

    const merged = Array.from(new Set([...firestoreCategories, ...productCategories]));
    return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

export const addCategory = async (categoryName: string): Promise<string> => {
  const trimmed = categoryName.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');
  
  const existing = await getCategories();
  const found = existing.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (found) {
    return found; // Return existing if matches case-insensitively
  }

  await addDoc(collection(db, 'categories'), {
    name: trimmed,
    createdAt: new Date()
  });

  return trimmed;
};

export const updateCategory = async (oldName: string, newName: string): Promise<void> => {
  const trimmedNew = newName.trim();
  if (!trimmedNew) throw new Error('Category name cannot be empty');
  if (oldName === trimmedNew) return;

  // 1. Update or create in Firestore categories collection
  const snap = await getDocs(collection(db, 'categories'));
  const targetDoc = snap.docs.find(d => d.data().name === oldName);

  if (targetDoc) {
    await updateDoc(doc(db, 'categories', targetDoc.id), {
      name: trimmedNew,
      updatedAt: new Date()
    });
  } else {
    // Create new category document in Firestore
    await addDoc(collection(db, 'categories'), {
      name: trimmedNew,
      createdAt: new Date()
    });
  }

  // 2. Cascade category name update to all products in Firestore
  try {
    const productsSnap = await getDocs(query(collection(db, 'products'), where('category', '==', oldName)));
    const updatePromises = productsSnap.docs.map(productDoc =>
      updateDoc(doc(db, 'products', productDoc.id), {
        category: trimmedNew,
        updatedAt: new Date()
      })
    );
    await Promise.all(updatePromises);
  } catch (err) {
    console.error('Error updating products category references:', err);
  }
};

export const deleteCategory = async (categoryName: string): Promise<void> => {
  const snap = await getDocs(collection(db, 'categories'));
  const targetDoc = snap.docs.find(d => d.data().name === categoryName);
  if (targetDoc) {
    await deleteDoc(doc(db, 'categories', targetDoc.id));
  }

  // Cascade category removal: set matching products to 'Uncategorized'
  try {
    const productsSnap = await getDocs(query(collection(db, 'products'), where('category', '==', categoryName)));
    const updatePromises = productsSnap.docs.map(productDoc =>
      updateDoc(doc(db, 'products', productDoc.id), {
        category: 'Uncategorized',
        updatedAt: new Date()
      })
    );
    await Promise.all(updatePromises);
  } catch (err) {
    console.error('Error reassigning products to Uncategorized:', err);
  }
};

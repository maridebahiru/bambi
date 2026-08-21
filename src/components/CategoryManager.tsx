import React, { useState, useEffect } from 'react';
import { Tag, Plus, Edit, Trash2, Check, X, FolderCheck } from 'lucide-react';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../lib/categoryService';
import { useToast } from '@/hooks/use-toast';

interface CategoryManagerProps {
  onCategoriesChanged?: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onCategoriesChanged }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a category name",
        variant: "destructive"
      });
      return;
    }

    setAdding(true);
    try {
      await addCategory(newCategory.trim());
      setNewCategory('');
      await fetchCategories();
      if (onCategoriesChanged) onCategoriesChanged();
      
      toast({
        title: "Success",
        description: "New category added successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to add category",
        variant: "destructive"
      });
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (categoryName: string) => {
    setEditingCategory(categoryName);
    setEditInputValue(categoryName);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditInputValue('');
  };

  const handleSaveEdit = async (oldName: string) => {
    if (!editInputValue.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    if (editInputValue.trim() === oldName) {
      handleCancelEdit();
      return;
    }

    setUpdating(true);
    try {
      await updateCategory(oldName, editInputValue.trim());
      setEditingCategory(null);
      setEditInputValue('');
      await fetchCategories();
      if (onCategoriesChanged) onCategoriesChanged();

      toast({
        title: "Category Updated",
        description: `Category "${oldName}" renamed to "${editInputValue.trim()}" across inventory!`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update category",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    if (confirm(`Are you sure you want to delete category "${categoryName}"? Any products in this category will be set to "Uncategorized".`)) {
      try {
        await deleteCategory(categoryName);
        await fetchCategories();
        if (onCategoriesChanged) onCategoriesChanged();
        
        toast({
          title: "Category Deleted",
          description: `Category "${categoryName}" deleted successfully.`
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete category",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
      {/* Card Header */}
      <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Tag className="text-blue-600 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category Management (CRUD)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Add, edit, rename, and delete product categories for inventory management</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Add Category Form */}
        <form onSubmit={handleAddCategory} className="flex gap-3">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Enter new category name..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center transition-colors disabled:bg-gray-400"
          >
            <Plus size={16} className="mr-1.5" />
            {adding ? 'Adding...' : 'Add Category'}
          </button>
        </form>

        {/* Categories List */}
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                All Product Categories ({categories.length})
              </div>
              <span className="text-xs text-gray-400">Click pencil to edit or trash to delete</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const isEditingThis = editingCategory === cat;

                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {isEditingThis ? (
                      <div className="flex items-center space-x-2 w-full">
                        <input
                          type="text"
                          value={editInputValue}
                          onChange={(e) => setEditInputValue(e.target.value)}
                          className="flex-1 px-2.5 py-1 border border-blue-500 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(cat);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={updating}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          title="Save changes"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2 truncate pr-2">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{cat}</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit category name"
                          >
                            <Edit size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;

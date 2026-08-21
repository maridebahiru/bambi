
import React, { useState, useEffect } from 'react';
import { X, Truck, Plus } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { getCategories, addCategory } from '../lib/categoryService';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductAdded: () => void;
}

const AddProductModal = ({ isOpen, onClose, onProductAdded }: AddProductModalProps) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    purchasePrice: 0,
    interestPercent: 0,
    stock: 0,
    supplierName: '',
    invoiceNumber: ''
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    const cats = await getCategories();
    setCategories(cats);
  };

  const handleCreateInlineCategory = async () => {
    if (!customCategoryInput.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty",
        variant: "destructive"
      });
      return;
    }

    try {
      const addedCat = await addCategory(customCategoryInput.trim());
      await fetchCategories();
      setFormData(prev => ({ ...prev, category: addedCat }));
      setCustomCategoryInput('');
      setIsAddingNewCategory(false);
      toast({
        title: "Success",
        description: `Category "${addedCat}" added and selected!`
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to add category",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.code.trim()) {
      toast({
        title: "Validation Error",
        description: "Product Code / SKU is required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name is required",
        variant: "destructive"
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Validation Error", 
        description: "Please select a category",
        variant: "destructive"
      });
      return;
    }

    if (formData.purchasePrice <= 0) {
      toast({
        title: "Validation Error",
        description: "Purchase price must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    if (formData.interestPercent < 0) {
      toast({
        title: "Validation Error",
        description: "Interest percentage cannot be negative",
        variant: "destructive"
      });
      return;
    }

    if (formData.stock < 0) {
      toast({
        title: "Validation Error",
        description: "Stock quantity cannot be negative",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const sellingPrice = formData.purchasePrice + (formData.purchasePrice * formData.interestPercent / 100);
      const productCode = formData.code.trim() || `PRD-${Date.now().toString().slice(-6)}`;

      const productRef = await addDoc(collection(db, 'products'), {
        code: productCode,
        name: formData.name.trim(),
        category: formData.category,
        purchasePrice: formData.purchasePrice,
        interestPercent: formData.interestPercent,
        price: sellingPrice,
        stock: formData.stock,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Auto-create Accounts Payable record for initial stock
      if (formData.stock > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await addDoc(collection(db, 'payables'), {
          supplierName: formData.supplierName.trim() || 'General Supplier',
          invoiceNumber: formData.invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
          amountOwed: formData.purchasePrice * formData.stock,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'Unpaid',
          productId: productRef.id,
          productName: formData.name.trim(),
          quantityAdded: formData.stock,
          unitCost: formData.purchasePrice,
          createdAt: new Date(),
          paidAt: null
        });
      }

      // Reset form
      setFormData({
        code: '',
        name: '',
        category: '',
        purchasePrice: 0,
        interestPercent: 0,
        stock: 0,
        supplierName: '',
        invoiceNumber: ''
      });

      // Close modal and refresh products
      onClose();
      onProductAdded();

      toast({
        title: "Success",
        description: formData.stock > 0 
          ? "Product added & payable record generated!" 
          : "Product added successfully!"
      });

    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Product</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Code / SKU *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="e.g. PRD-1001 or scan barcode"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Category *
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
              >
                <Plus size={12} className="mr-0.5" />
                {isAddingNewCategory ? 'Cancel' : 'New Category'}
              </button>
            </div>

            {isAddingNewCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  placeholder="Enter new category name..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreateInlineCategory}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            ) : (
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Price (birr) *
            </label>
            <input
              type="number"
              value={formData.purchasePrice || ''}
              onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interest Percentage (%)
            </label>
            <input
              type="number"
              value={formData.interestPercent || ''}
              onChange={(e) => setFormData({ ...formData, interestPercent: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.1"
              placeholder="0.0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initial Stock Quantity *
            </label>
            <input
              type="number"
              value={formData.stock || ''}
              onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              placeholder="0"
              required
            />
          </div>

          {/* Supplier Info for Payables */}
          {formData.stock > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center text-xs font-semibold text-slate-700">
                <Truck size={14} className="mr-1.5 text-blue-600" />
                Restock Supplier Details (Accounts Payable)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  placeholder="Supplier Name"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white"
                />
                <input
                  type="text"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  placeholder="Invoice #"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
            <strong>Selling Price: birr{(formData.purchasePrice + (formData.purchasePrice * formData.interestPercent / 100)).toFixed(2)}</strong>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;


import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { updateDoc, addDoc, collection, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  code?: string;
  name: string;
  category: string;
  purchasePrice: number;
  interestPercent: number;
  stock: number;
  price: number;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: () => void;
  product: Product | null;
}

const EditProductModal = ({ isOpen, onClose, onProductUpdated, product }: EditProductModalProps) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    purchasePrice: 0,
    interestPercent: 0,
    stock: 0
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const categories = [
    'Mobiles',
    'Smart Phones',
    'Non-Smart Phones',
    'Laptops',
    'Computers & Desktops',
    'Mobile Accessories',
    'Glasses',
    'Covers',
    'Chargers',
    'Electrical Tools'
  ];

  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code || '',
        name: product.name,
        category: product.category,
        purchasePrice: product.purchasePrice || 0,
        interestPercent: product.interestPercent || 0,
        stock: product.stock
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;

    // Validate form data
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

    setLoading(true);

    try {
      const sellingPrice = formData.purchasePrice + (formData.purchasePrice * formData.interestPercent / 100);
      const productCode = formData.code.trim() || `PRD-${Date.now().toString().slice(-6)}`;
      
      await updateDoc(doc(db, 'products', product.id), {
        code: productCode,
        name: formData.name.trim(),
        category: formData.category,
        purchasePrice: formData.purchasePrice,
        interestPercent: formData.interestPercent,
        price: sellingPrice,
        stock: formData.stock,
        updatedAt: new Date()
      });

      // Auto-create payable if stock is increased
      if (formData.stock > product.stock) {
        const addedQty = formData.stock - product.stock;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await addDoc(collection(db, 'payables'), {
          supplierName: 'Restock Supplier',
          invoiceNumber: `RESTOCK-${Date.now().toString().slice(-6)}`,
          amountOwed: formData.purchasePrice * addedQty,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'Unpaid',
          productId: product.id,
          productName: formData.name.trim(),
          quantityAdded: addedQty,
          unitCost: formData.purchasePrice,
          createdAt: new Date(),
          paidAt: null
        });
      }

      onClose();
      onProductUpdated();

      toast({
        title: "Success",
        description: formData.stock > product.stock
          ? `Product updated & payable for +${formData.stock - product.stock} units generated!`
          : "Product updated successfully!"
      });

    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Product</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Code / SKU
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="e.g. PRD-1001"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Price ($) *
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
              Stock Quantity *
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

          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
            <strong>Selling Price: ${(formData.purchasePrice + (formData.purchasePrice * formData.interestPercent / 100)).toFixed(2)}</strong>
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
              {loading ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;

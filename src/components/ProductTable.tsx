import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, FileSpreadsheet } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useToast } from "@/hooks/use-toast";
import AddProductModal from './AddProductModal';
import EditProductModal from './EditProductModal';
import ImportProductsModal from './ImportProductsModal';
import { useAuth } from '../contexts/AuthContext';

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

const ProductTable = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);

      // Extract unique categories
      const uniqueCategories = [...new Set(productsData.map(product => product.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
        setProducts(products.filter(product => product.id !== productId));
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditModalOpen(true);
  };

  const filteredProducts = products.filter(product => {
    const term = searchTerm.toLowerCase();
    const nameMatch = product.name.toLowerCase().includes(term);
    const codeMatch = product.code ? product.code.toLowerCase().includes(term) : false;
    const searchMatch = nameMatch || codeMatch;
    const categoryMatch = selectedCategory ? product.category === selectedCategory : true;
    return searchMatch && categoryMatch;
  });

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center">
              <Package className="text-blue-600 mr-3" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">Products</h3>
            </div>
            
            {userProfile?.role === 'admin' && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center shadow-sm"
                >
                  <FileSpreadsheet size={16} className="mr-2" />
                  Import Excel
                </button>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm"
                >
                  <Plus size={16} className="mr-2" />
                  Add Product
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                {userProfile?.role === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded border border-gray-200">
                      {product.code || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {product.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    birr {product.price?.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      product.stock < 10 
                        ? 'bg-red-100 text-red-800' 
                        : product.stock < 50 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {product.stock} units
                    </span>
                  </td>
                  {userProfile?.role === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || selectedCategory ? 'No products found matching your search.' : 'No products found.'}
          </div>
        )}
      </div>

      {userProfile?.role === 'admin' && (
        <>
          <AddProductModal 
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onProductAdded={fetchProducts}
          />

          <EditProductModal 
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onProductUpdated={fetchProducts}
            product={selectedProduct}
          />

          <ImportProductsModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onProductsImported={fetchProducts}
          />
        </>
      )}
    </>
  );
};

export default ProductTable;

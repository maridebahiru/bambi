import React, { useState, useEffect } from 'react';
import { Percent, AlertTriangle, CheckCircle, TrendingDown, Search, Filter } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface ProductDoc {
  id: string;
  name: string;
  category: string;
  purchasePrice?: number;
  price: number;
  stock: number;
}

const MarginAnalysis: React.FC = () => {
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'products'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ProductDoc[];
      setProducts(list);
    } catch (e) {
      console.error('Error loading products for margin analysis:', e);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory ? p.category === selectedCategory : true;
    return matchSearch && matchCat;
  });

  // Flagged items count
  const negativeMarginItems = products.filter(p => {
    const cost = p.purchasePrice || 0;
    const profit = p.price - cost;
    return profit < 0;
  });

  const lowMarginItems = products.filter(p => {
    const cost = p.purchasePrice || 0;
    const profit = p.price - cost;
    const marginPct = p.price > 0 ? (profit / p.price) * 100 : 0;
    return marginPct >= 0 && marginPct < 15;
  });

  return (
    <div className="space-y-6">
      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total Tracked Products</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{products.length}</h3>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
            <Percent size={20} />
          </div>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-5 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase">Low Margin Items (&lt;15%)</p>
            <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">{lowMarginItems.length}</h3>
          </div>
          <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-red-50/70 dark:bg-red-950/30 p-5 rounded-lg border border-red-200 dark:border-red-900/50 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-red-800 dark:text-red-300 uppercase">Negative Margin Items (&lt;0%)</p>
            <h3 className="text-2xl font-bold text-red-900 dark:text-red-200 mt-1">{negativeMarginItems.length}</h3>
          </div>
          <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg">
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search products by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
        <div className="w-full md:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Margin Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Product</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-right">Cost Price</th>
                <th className="px-6 py-3 text-right">Selling Price</th>
                <th className="px-6 py-3 text-right">Unit Profit</th>
                <th className="px-6 py-3 text-right">Margin %</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredProducts.map((p) => {
                const cost = p.purchasePrice || 0;
                const sellingPrice = p.price || 0;
                const profit = sellingPrice - cost;
                const marginPct = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

                let badge = (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 inline-flex items-center">
                    <CheckCircle size={12} className="mr-1" /> Healthy
                  </span>
                );

                if (marginPct < 0) {
                  badge = (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 inline-flex items-center">
                      <TrendingDown size={12} className="mr-1" /> Negative
                    </span>
                  );
                } else if (marginPct < 15) {
                  badge = (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 inline-flex items-center">
                      <AlertTriangle size={12} className="mr-1" /> Low (&lt;15%)
                    </span>
                  );
                }

                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{p.category}</td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white">Br {cost.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">Br {sellingPrice.toFixed(2)}</td>
                    <td className={`px-6 py-4 text-right font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      Br {profit.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${marginPct >= 15 ? 'text-emerald-600' : marginPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {marginPct.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-center">{badge}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">No products found matching filters.</div>
        )}
      </div>
    </div>
  );
};

export default MarginAnalysis;

import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Package, Filter, Plus, Minus, Trash2, Percent, Receipt } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useToast } from "@/hooks/use-toast";
import { generateSaleReceipt } from './PDFGenerator';
import { getCategories } from '../lib/categoryService';
import { getTaxSettings, TaxSettings } from '../lib/taxSettings';

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const QuickSale = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isVatExempt, setIsVatExempt] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { userProfile } = useAuth();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  const paymentMethods = ['Cash', 'Loan / Credit', 'CBE Mobile Banking', 'Telebirr', 'Amhara Bank', 'Awash Bank', 'Wegagen Bank', 'Oromia Bank', 'Abisiniya Bank', 'Other'];

  useEffect(() => {
    fetchProductsAndSettings();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory]);

  const fetchProductsAndSettings = async () => {
    try {
      const settings = await getTaxSettings();
      setTaxSettings(settings);

      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData.filter(p => p.stock > 0));

      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load products or tax settings",
        variant: "destructive"
      });
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(term) ||
        (product.code ? product.code.toLowerCase().includes(term) : false)
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const addToCart = (product: Product) => {
    const existingCartItem = cart.find(item => item.product.id === product.id);

    if (existingCartItem) {
      if (existingCartItem.quantity + 1 > product.stock) {
        toast({
          title: "Error",
          description: "Not enough stock available",
          variant: "destructive"
        });
        return;
      }
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (newQuantity > product.stock) {
      toast({
        title: "Error",
        description: "Not enough stock available",
        variant: "destructive"
      });
      return;
    }

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const activeVatRate = (taxSettings.vatEnabled && !isVatExempt) ? taxSettings.vatRate : 0;
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartVatAmount = cartSubtotal * (activeVatRate / 100);
  const cartGrandTotal = cartSubtotal + cartVatAmount;

  const handleSale = async () => {
    if (cart.length === 0 || !userProfile) return;

    if (paymentMethod === 'Loan / Credit') {
      if (!buyerName.trim()) {
        toast({
          title: "Validation Error",
          description: "Customer Name is required for Credit / Loan sales.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);
    try {
      const saleTimestamp = new Date();

      for (const cartItem of cart) {
        const itemSubtotal = cartItem.product.price * cartItem.quantity;
        const itemVatAmount = itemSubtotal * (activeVatRate / 100);
        const itemTotalPrice = itemSubtotal + itemVatAmount;
        const unitCost = cartItem.product.purchasePrice || 0;

        await addDoc(collection(db, 'sales'), {
          productId: cartItem.product.id,
          productName: cartItem.product.name,
          category: cartItem.product.category,
          quantity: cartItem.quantity,
          unitPrice: cartItem.product.price,
          unitCost: unitCost,
          subtotal: itemSubtotal,
          vatRate: activeVatRate,
          vatAmount: itemVatAmount,
          totalPrice: itemTotalPrice,
          buyerName: buyerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          sellerId: userProfile.uid,
          sellerName: userProfile.name,
          timestamp: saleTimestamp,
          date: saleTimestamp.toISOString().split('T')[0],
          paymentMethod
        });

        const productRef = doc(db, 'products', cartItem.product.id);
        await updateDoc(productRef, {
          stock: cartItem.product.stock - cartItem.quantity,
          updatedAt: new Date()
        });
      }

      generateSaleReceipt({
        items: cart.map(item => {
          const itemSubtotal = item.product.price * item.quantity;
          const itemVatAmount = itemSubtotal * (activeVatRate / 100);
          return {
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: item.product.price,
            totalPrice: itemSubtotal + itemVatAmount
          };
        }),
        buyerName: buyerName || 'Walk-in Customer',
        timestamp: saleTimestamp,
        subtotal: cartSubtotal,
        vatRate: activeVatRate,
        vatAmount: cartVatAmount,
        totalAmount: cartGrandTotal,
        paymentMethod
      }, userProfile);

      setCart([]);
      setBuyerName('');
      setCustomerPhone('');
      fetchProductsAndSettings();

      toast({
        title: "Success",
        description: "Sale processed and receipt generated!"
      });

    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: "Error",
        description: "Failed to process sale",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Product Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <Package className="text-blue-600 mr-3" size={24} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Available Products</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
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

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredProducts.map((product) => (
            <div key={product.id} className="p-3 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                    {product.code && (
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded">
                        {product.code}
                      </span>
                    )}
                    <span>{product.name}</span>
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(product.price)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Stock: {product.stock}</p>
                  <button
                    onClick={() => addToCart(product)}
                    className="mt-1 bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No products found matching your criteria
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <ShoppingCart className="text-green-600 mr-3" size={24} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cart & POS Checkout</h3>
        </div>

        {cart.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-lg border dark:border-gray-700 max-h-60 overflow-y-auto">
              <h4 className="font-medium text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Items in Cart</h4>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded border dark:border-gray-700">
                    <div className="flex-1 pr-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white block truncate">{item.product.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(item.product.price)} each</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                        <Minus size={10} />
                      </button>
                      <span className="px-2 text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">
                        <Plus size={10} />
                      </button>
                      <button onClick={() => removeFromCart(item.product.id)} className="p-1 bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 rounded ml-1">
                        <Trash2 size={10} />
                      </button>
                      <span className="font-semibold text-sm min-w-[70px] text-right text-gray-900 dark:text-white">
                        {formatCurrency(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer Name {paymentMethod === 'Loan / Credit' ? '*' : '(Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Abebe Kebede"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-medium"
                >
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* VAT Rate & Exempt Toggle */}
            {taxSettings.vatEnabled && (
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-750 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-2">
                  <Percent size={14} className="text-blue-600" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    VAT Rate: <strong>{taxSettings.vatRate}%</strong>
                  </span>
                </div>
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVatExempt}
                    onChange={(e) => setIsVatExempt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>VAT Exempt (0%)</span>
                </label>
              </div>
            )}

            {/* Total Summary Box with Subtotal, VAT, and Grand Total */}
            <div className="bg-slate-900 text-white p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Subtotal:</span>
                <span>{formatCurrency(cartSubtotal)}</span>
              </div>

              {taxSettings.vatEnabled && (
                <div className="flex justify-between text-xs text-blue-300">
                  <span>VAT ({activeVatRate}%):</span>
                  <span>+ {formatCurrency(cartVatAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-bold border-t border-slate-700 pt-2 text-emerald-400">
                <span>Grand Total:</span>
                <span className="text-lg">{formatCurrency(cartGrandTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleSale}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium flex items-center justify-center transition-colors shadow-sm"
            >
              <ShoppingCart size={16} className="mr-2" />
              {loading ? 'Processing Sale...' : 'Complete Sale & Print Receipt'}
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p>Add products to cart to process a sale with VAT calculation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickSale;

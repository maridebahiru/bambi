import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Package, Filter, Plus, Minus, Trash2, Percent, Receipt, DollarSign, CheckSquare } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useToast } from "@/hooks/use-toast";
import { generateSaleReceipt } from './PDFGenerator';
import { getCategories } from '../lib/categoryService';
import { getTaxSettings, TaxSettings } from '../lib/taxSettings';
import { logActivity } from '../lib/activityLogger';

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
  overridePrice?: number;
}

const QuickSale = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [initialDeposit, setInitialDeposit] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [sentToCashRegister, setSentToCashRegister] = useState(true);
  const [isVatExempt, setIsVatExempt] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Seller Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: '',
    category: 'Transport',
    customCategory: '',
    amount: 0
  });

  const { userProfile } = useAuth();
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  const paymentMethods = [
    'Cash',
    'Loan / Credit',
    'CBE Mobile Banking',
    'Telebirr',
    'E-Birr Kaffi',
    'E-Birr Coop',
    'Dashen Bank',
    'Birhan Bank',
    'Amhara Bank',
    'Awash Bank',
    'Wegagen Bank',
    'Oromia Bank',
    'Abisiniya Bank',
    'Other'
  ];

  const expenseCategories = ['Transport', 'Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'];

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
      setCart([...cart, { product, quantity: 1, overridePrice: product.price }]);
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

  const updatePrice = (productId: string, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        if (item.product.price !== validPrice) {
          logActivity('EDIT_PRICE', `Price modified for ${item.product.name}: Original Br ${item.product.price} -> Modified Br ${validPrice}`, undefined, {
            productId: item.product.id,
            productName: item.product.name,
            originalPrice: item.product.price,
            newPrice: validPrice
          });
        }
        return { ...item, overridePrice: validPrice };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const getItemUnitPrice = (item: CartItem) => {
    return item.overridePrice !== undefined ? item.overridePrice : item.product.price;
  };

  const activeVatRate = (taxSettings.vatEnabled && !isVatExempt) ? taxSettings.vatRate : 0;
  const cartSubtotal = cart.reduce((sum, item) => sum + (getItemUnitPrice(item) * item.quantity), 0);
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
        const finalUnitPrice = getItemUnitPrice(cartItem);
        const itemSubtotal = finalUnitPrice * cartItem.quantity;
        const itemVatAmount = itemSubtotal * (activeVatRate / 100);
        const itemTotalPrice = itemSubtotal + itemVatAmount;
        const unitCost = cartItem.product.purchasePrice || 0;

        await addDoc(collection(db, 'sales'), {
          productId: cartItem.product.id,
          productName: cartItem.product.name,
          category: cartItem.product.category,
          quantity: cartItem.quantity,
          originalUnitPrice: cartItem.product.price,
          unitPrice: finalUnitPrice,
          unitCost: unitCost,
          subtotal: itemSubtotal,
          vatRate: activeVatRate,
          vatAmount: itemVatAmount,
          totalPrice: itemTotalPrice,
          buyerName: buyerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          sellerId: userProfile.uid,
          sellerName: userProfile.name,
          sentToCashRegister,
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

      // If credit sale, record to Accounts Receivable collection
      if (paymentMethod === 'Loan / Credit') {
        const paidNow = Math.min(cartGrandTotal, Math.max(0, initialDeposit));
        const remaining = Math.max(0, cartGrandTotal - paidNow);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        const summaryStr = cart.map(i => `${i.product.name} (x${i.quantity})`).join(', ');

        await addDoc(collection(db, 'receivables'), {
          customerName: buyerName.trim(),
          customerPhone: customerPhone.trim(),
          productNames: summaryStr,
          totalAmount: cartGrandTotal,
          amountPaid: paidNow,
          balanceRemaining: remaining,
          dueDate: dueDate.toISOString().split('T')[0],
          status: remaining <= 0 ? 'Paid' : (paidNow > 0 ? 'Partially Paid' : 'Unpaid'),
          createdAt: saleTimestamp,
          lastPaymentDate: paidNow > 0 ? saleTimestamp : null,
          paymentHistory: paidNow > 0 ? [
            {
              amount: paidNow,
              paymentMethod: 'Initial Credit Deposit',
              date: saleTimestamp.toISOString().split('T')[0],
              notes: 'Initial down payment at Quick Sale checkout'
            }
          ] : []
        });
      }

      logActivity('CREATE_SALE', `Quick sale created: ${cart.length} item(s) total Br ${cartGrandTotal.toFixed(2)} (${paymentMethod}${sentToCashRegister ? ', Cash Register' : ''})`, undefined, {
        totalAmount: cartGrandTotal,
        paymentMethod,
        sentToCashRegister,
        buyerName: buyerName || 'Walk-in Customer'
      });

      generateSaleReceipt({
        items: cart.map(item => {
          const finalPrice = getItemUnitPrice(item);
          const itemSubtotal = finalPrice * item.quantity;
          const itemVatAmount = itemSubtotal * (activeVatRate / 100);
          return {
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: finalPrice,
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
      setInitialDeposit(0);
      setSentToCashRegister(true);
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

  const handleLogSellerExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseData.description.trim() || expenseData.amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Enter a valid description and amount",
        variant: "destructive"
      });
      return;
    }

    if (expenseData.category === 'Other' && !expenseData.customCategory.trim()) {
      toast({
        title: "Validation Error",
        description: "Please specify the custom category name for Other expense.",
        variant: "destructive"
      });
      return;
    }

    const finalCategory = (expenseData.category === 'Other' && expenseData.customCategory.trim())
      ? `Other (${expenseData.customCategory.trim()})`
      : expenseData.category;

    try {
      await addDoc(collection(db, 'expenses'), {
        description: expenseData.description.trim(),
        category: finalCategory,
        amount: expenseData.amount,
        date: new Date().toISOString().split('T')[0],
        createdBy: userProfile?.name || 'Staff',
        creatorRole: userProfile?.role || 'staff',
        createdAt: new Date()
      });

      logActivity('ADD_EXPENSE', `Quick sale user logged expense: ${finalCategory} - Br ${expenseData.amount} (${expenseData.description.trim()})`, undefined, {
        category: finalCategory,
        amount: expenseData.amount,
        description: expenseData.description.trim()
      });

      setIsExpenseModalOpen(false);
      setExpenseData({ description: '', category: 'Transport', customCategory: '', amount: 0 });
      toast({
        title: "Expense Recorded",
        description: `Logged Br ${expenseData.amount} under ${finalCategory}`
      });
    } catch (error) {
      console.error('Error logging seller expense:', error);
      toast({
        title: "Error",
        description: "Failed to record expense",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header bar for quick expense logging */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick POS Counter</h2>
          <p className="text-xs text-gray-500">Fast checkout interface for counter sales</p>
        </div>
        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
        >
          <DollarSign size={14} />
          <span>Log Shift Expense</span>
        </button>
      </div>

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
                placeholder="Search products by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
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
                  {cart.map((item) => {
                    const currentPrice = getItemUnitPrice(item);
                    const isDiscounted = item.overridePrice !== undefined && item.overridePrice !== item.product.price;

                    return (
                      <div key={item.product.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded border dark:border-gray-700 gap-2">
                        <div className="flex-1 pr-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white block truncate">{item.product.name}</span>
                          <div className="flex items-center space-x-2 text-xs">
                            {isDiscounted && (
                              <span className="line-through text-gray-400">Br {item.product.price}</span>
                            )}
                            <span className="font-bold text-emerald-600">Br {currentPrice}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] text-gray-400">Price:</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => updatePrice(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-16 px-1 py-0.5 border rounded text-xs text-right bg-white dark:bg-gray-700 font-semibold"
                            />
                          </div>

                          <div className="flex items-center space-x-1">
                            <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">
                              <Minus size={10} />
                            </button>
                            <span className="px-1.5 text-xs font-semibold">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300">
                              <Plus size={10} />
                            </button>
                            <button onClick={() => removeFromCart(item.product.id)} className="p-1 bg-red-100 text-red-600 rounded ml-1">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                    Customer Phone {paymentMethod === 'Loan / Credit' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +251 911 123456"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {paymentMethod === 'Loan / Credit' && (
                  <div>
                    <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      Initial Down Payment / Deposit (Br)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={cartGrandTotal}
                      step="0.01"
                      placeholder="0.00"
                      value={initialDeposit || ''}
                      onChange={(e) => setInitialDeposit(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg dark:bg-gray-700 dark:text-white font-bold text-emerald-600 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Credit Sale Loan Summary Card */}
              {paymentMethod === 'Loan / Credit' && (
                <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                  <div className="flex justify-between">
                    <span>Total Order Amount:</span>
                    <span className="font-bold">Br {cartGrandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Down Payment Paid Now:</span>
                    <span className="font-bold text-emerald-600">Br {(Math.min(cartGrandTotal, Math.max(0, initialDeposit))).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 dark:border-amber-800 pt-1 font-bold">
                    <span>Recorded to Accounts Receivable (Customer Debt):</span>
                    <span className="text-red-600 dark:text-red-400">Br {Math.max(0, cartGrandTotal - Math.min(cartGrandTotal, Math.max(0, initialDeposit))).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Cash Register Link Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="text-blue-600" size={14} />
                  <span className="font-semibold text-blue-900">Sent to Cash Register</span>
                </div>
                <label className="flex items-center cursor-pointer space-x-1.5">
                  <input
                    type="checkbox"
                    checked={sentToCashRegister}
                    onChange={(e) => setSentToCashRegister(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-gray-600 font-medium">
                    {sentToCashRegister ? 'Tax Linked' : 'Not Linked'}
                  </span>
                </label>
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

      {/* Seller Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="text-amber-600" size={20} />
              Log Shift Operating Expense
            </h3>
            <p className="text-xs text-gray-500">Record daily shop expenses (transport, supplies, etc.) for reporting.</p>
            
            <form onSubmit={handleLogSellerExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Expense Category *</label>
                <select
                  value={expenseData.category}
                  onChange={(e) => setExpenseData({ ...expenseData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 font-medium"
                >
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {expenseData.category === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Specify Custom Expense Category / Variety *
                  </label>
                  <input
                    type="text"
                    value={expenseData.customCategory}
                    onChange={(e) => setExpenseData({ ...expenseData, customCategory: e.target.value })}
                    placeholder="e.g. Equipment Repair, Shop Cleaning..."
                    className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Amount (ETB) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={expenseData.amount || ''}
                  onChange={(e) => setExpenseData({ ...expenseData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description / Notes *</label>
                <textarea
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                  placeholder="e.g. Taxi fare for delivery"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                  rows={2}
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickSale;

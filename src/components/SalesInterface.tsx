import React, { useState, useEffect } from 'react';
import { ShoppingCart, Receipt, User, Plus, Minus, Trash2, Percent, Edit2, DollarSign, Search, Filter, Package, Zap, Download } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateSaleReceipt } from './PDFGenerator';
import { useToast } from "@/hooks/use-toast";
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

const SalesInterface = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [buyerName, setBuyerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [initialDeposit, setInitialDeposit] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [sentToCashRegister, setSentToCashRegister] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVatExempt, setIsVatExempt] = useState(false);
  const [lastCompletedReceipt, setLastCompletedReceipt] = useState<any>(null);

  // Seller Shift Operating Expense State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: '',
    category: 'Transport',
    customCategory: '',
    amount: 0
  });
  const expenseCategories = ['Transport', 'Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'];

  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });

  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchProductsAndTax();
  }, []);

  const fetchProductsAndTax = async () => {
    try {
      const settings = await getTaxSettings();
      setTaxSettings(settings);

      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);

      const uniqueCats = Array.from(new Set(productsData.map(p => p.category).filter(Boolean)));
      setCategories(uniqueCats);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      product.name.toLowerCase().includes(term) ||
      (product.code && product.code.toLowerCase().includes(term)) ||
      product.category.toLowerCase().includes(term);
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const addToCartDirect = (product: Product) => {
    if (product.stock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently out of stock.`,
        variant: "destructive"
      });
      return;
    }

    const existingCartItem = cart.find(item => item.product.id === product.id);

    if (existingCartItem) {
      if (existingCartItem.quantity + 1 > product.stock) {
        toast({
          title: "Stock Limit Reached",
          description: `Cannot add more ${product.name}. Stock limit reached.`,
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

    toast({
      title: "Added to Cart",
      description: `Added 1x ${product.name}`
    });
  };

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchTerm.trim()) return;

      const exactMatch = products.find(
        p => p.code?.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      const targetProduct = exactMatch || (filteredProducts.length === 1 ? filteredProducts[0] : null);

      if (targetProduct) {
        addToCartDirect(targetProduct);
        setSearchTerm('');
      } else {
        toast({
          title: "Product Not Found",
          description: `No matching product code found for "${searchTerm.trim()}"`,
          variant: "destructive"
        });
      }
    }
  };

  const getItemUnitPrice = (item: CartItem): number => {
    return item.overridePrice !== undefined ? item.overridePrice : item.product.price;
  };

  const updateItemPrice = (productId: string, newPrice: number) => {
    const item = cart.find(i => i.product.id === productId);
    if (item && !isNaN(newPrice) && newPrice >= 0) {
      setCart(cart.map(i =>
        i.product.id === productId ? { ...i, overridePrice: newPrice } : i
      ));

      if (newPrice !== item.product.price) {
        logActivity('EDIT_PRICE', `Price modified for ${item.product.name}: Original Br ${item.product.price} -> Modified Br ${newPrice}`, undefined, {
          productId: item.product.id,
          productName: item.product.name,
          originalPrice: item.product.price,
          newPrice: newPrice
        });
      }
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
  const cartSubtotal = cart.reduce((sum, item) => sum + (getItemUnitPrice(item) * item.quantity), 0);
  const cartVatAmount = cartSubtotal * (activeVatRate / 100);
  const cartGrandTotal = cartSubtotal + cartVatAmount;

  const handleSale = async () => {
    if (cart.length === 0 || !userProfile) return;

    // Validate Credit Sale Requirements
    if (paymentMethod === 'Loan / Credit') {
      if (!buyerName.trim()) {
        toast({
          title: "Validation Error",
          description: "Customer Name is required for Credit / Loan sales.",
          variant: "destructive"
        });
        return;
      }
      if (!customerPhone.trim()) {
        toast({
          title: "Validation Error",
          description: "Customer Phone Number is required for Credit / Loan sales.",
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
        const unitCost = cartItem.product.purchasePrice || (cartItem.product.price * 0.7);

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
              notes: 'Initial down payment at POS checkout'
            }
          ] : []
        });
      }

      logActivity('CREATE_SALE', `Sale completed: ${cart.length} item(s) total Br ${cartGrandTotal.toFixed(2)} (${paymentMethod}${sentToCashRegister ? ', Cash Register ON' : ', Cash Register OFF'})`, undefined, {
        totalAmount: cartGrandTotal,
        paymentMethod,
        sentToCashRegister,
        buyerName: buyerName || 'Walk-in Customer'
      });

      const receiptData = {
        items: cart.map(item => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: getItemUnitPrice(item),
          totalPrice: getItemUnitPrice(item) * item.quantity
        })),
        buyerName: buyerName || 'Walk-in Customer',
        sellerName: userProfile?.name,
        timestamp: saleTimestamp,
        subtotal: cartSubtotal,
        vatRate: activeVatRate,
        vatAmount: cartVatAmount,
        totalAmount: cartGrandTotal,
        paymentMethod
      };

      setLastCompletedReceipt(receiptData);

      setCart([]);
      setBuyerName('');
      setCustomerPhone('');
      setInitialDeposit(0);
      setSentToCashRegister(true);

      await fetchProductsAndTax();

      toast({
        title: "Sale Completed",
        description: "Sale processed successfully. Click 'Download Receipt' anytime to save the receipt PDF."
      });
    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: "Error",
        description: "Error processing sale. Please try again.",
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
      const todayStr = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, 'expenses'), {
        description: expenseData.description.trim(),
        category: finalCategory,
        amount: expenseData.amount,
        date: todayStr,
        createdBy: userProfile?.name || 'Seller',
        creatorRole: userProfile?.role || 'seller',
        createdAt: new Date()
      });

      logActivity('ADD_EXPENSE', `Seller logged expense: ${finalCategory} - Br ${expenseData.amount} (${expenseData.description.trim()})`, undefined, {
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
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6 pb-3 border-b">
        <div className="flex items-center">
          <ShoppingCart className="text-blue-600 mr-3" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Process POS Sale</h3>
            <p className="text-xs text-gray-500">Log customer sales and shift operating expenses</p>
          </div>
        </div>

        <button
          onClick={() => setIsExpenseModalOpen(true)}
          className="flex items-center space-x-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
        >
          <DollarSign size={16} className="text-amber-700" />
          <span>Log Operating Expense</span>
        </button>
      </div>

      {/* Completed Sale Receipt Banner */}
      {lastCompletedReceipt && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 p-4 rounded-xl mb-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 text-white p-2 rounded-full flex-shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Sale Completed!</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Customer: {lastCompletedReceipt.buyerName} | Total: Br {lastCompletedReceipt.totalAmount?.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => generateSaleReceipt(lastCompletedReceipt, userProfile)}
              className="flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow transition-colors"
            >
              <Download size={15} className="mr-1.5" />
              Download Receipt
            </button>
            <button
              onClick={() => setLastCompletedReceipt(null)}
              className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 text-xs px-2 py-1.5 font-bold"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Easy Product Search Section */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Search size={14} className="text-blue-600" />
              <span>Easy Product Search & Fast Scan</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">Press Enter on Code to Add</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Type product name, code/barcode, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDownSearch}
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Matching Product List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 pt-1 border-t dark:border-slate-700">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <div className="flex-1 pr-2 truncate">
                  <div className="flex items-center space-x-1.5">
                    {product.code && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-bold">
                        {product.code}
                      </span>
                    )}
                    <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">{product.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{product.category}</p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 block">Br {product.price}</span>
                    <span className={`text-[10px] font-bold ${
                      product.stock <= 0
                        ? 'text-red-500'
                        : product.stock <= 5
                        ? 'text-amber-500'
                        : 'text-slate-400'
                    }`}>
                      Stock: {product.stock}
                    </span>
                  </div>

                  <button
                    onClick={() => addToCartDirect(product)}
                    disabled={product.stock <= 0}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-md text-xs font-bold transition-colors flex items-center space-x-1 shadow-xs"
                  >
                    <Plus size={13} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">
                No products found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
          >
            <option value="Cash">Cash</option>
            <option value="Loan / Credit">Loan / Credit Sale (Customer Debt)</option>
            <option value="CBE Mobile Banking">CBE Mobile Banking</option>
            <option value="Telebirr">Telebirr</option>
            <option value="Amhara Bank">Amhara Bank</option>
            <option value="Awash Bank">Awash Bank</option>
            <option value="Wegagen Bank">Wegagen Bank</option>
            <option value="Oromia Bank">Oromia Bank</option>
            <option value="Abisiniya Bank">Abisiniya Bank</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Credit Sale Fields */}
        {paymentMethod === 'Loan / Credit' && (
          <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-lg space-y-3">
            <div className="text-xs font-bold text-amber-900 uppercase">
              Credit Sale Details (Accounts Receivable)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter full customer name"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer Phone # *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +251 91 123 4567"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Initial Down Payment / Deposit (birr)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={initialDeposit || ''}
                onChange={(e) => setInitialDeposit(parseFloat(e.target.value) || 0)}
                placeholder="0.00 (Amount paid in cash/transfer now)"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
              <p className="text-[11px] text-amber-800 mt-1">
                Remaining balance will be automatically tracked under Accounts Receivable.
              </p>
            </div>
          </div>
        )}

        {/* VAT Option Toggle */}
        {taxSettings.vatEnabled && (
          <div className="flex items-center justify-between p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-sm">
            <div className="flex items-center space-x-2">
              <Percent className="text-indigo-600" size={16} />
              <span className="font-medium text-gray-800">
                Apply VAT ({taxSettings.vatRate}%)
              </span>
            </div>
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="checkbox"
                checked={!isVatExempt}
                onChange={(e) => setIsVatExempt(!e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-600">{isVatExempt ? 'VAT Exempt' : 'Standard VAT'}</span>
            </label>
          </div>
        )}

        {/* Cash Register Official Tax Toggle */}
        <div className="flex items-center justify-between p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-sm">
          <div className="flex items-center space-x-2">
            <Receipt className="text-amber-700" size={16} />
            <span className="font-semibold text-amber-900">
              Send Sale to Cash Register (Official Tax Machine)
            </span>
          </div>
          <label className="flex items-center cursor-pointer space-x-2">
            <input
              type="checkbox"
              checked={sentToCashRegister}
              onChange={(e) => setSentToCashRegister(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
            />
            <span className="text-xs font-bold text-amber-800">
              {sentToCashRegister ? 'ON (Official Taxable)' : 'OFF (Internal/Off-Book)'}
            </span>
          </label>
        </div>

        {/* Cart Listing */}
        {cart.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-900 mb-2">Shopping Cart Items</h4>
            <div className="space-y-2">
              {cart.map((item) => {
                const currentPrice = getItemUnitPrice(item);
                const isDiscounted = item.overridePrice !== undefined && item.overridePrice !== item.product.price;

                return (
                  <div key={item.product.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-lg border gap-2 shadow-sm">
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900 text-sm block">{item.product.name}</span>
                      <div className="flex items-center space-x-2 text-xs mt-1">
                        {isDiscounted && (
                          <span className="line-through text-gray-400 font-medium">Br {item.product.price}</span>
                        )}
                        <span className="font-bold text-emerald-600">Br {currentPrice}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <span className="text-gray-500 text-[11px]">Edit Price:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.overridePrice ?? item.product.price}
                            onChange={(e) => updateItemPrice(item.product.id, parseFloat(e.target.value))}
                            className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-xs font-bold text-gray-800 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="px-2 font-bold text-xs">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        <Trash2 size={12} />
                      </button>
                      <span className="font-bold min-w-[70px] text-right text-gray-900 text-sm">
                        Br {(currentPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>Br {cartSubtotal.toFixed(2)}</span>
                </div>
                {activeVatRate > 0 && (
                  <div className="flex justify-between text-indigo-600">
                    <span>VAT ({activeVatRate}%):</span>
                    <span>Br {cartVatAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t">
                  <span>Total Amount:</span>
                  <span>Br {cartGrandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {paymentMethod !== 'Loan / Credit' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buyer Name (Optional)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Enter buyer name"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleSale}
            disabled={cart.length === 0 || loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium"
          >
            <ShoppingCart size={16} className="mr-2" />
            {loading ? 'Processing...' : `Process Sale (Br ${cartGrandTotal.toFixed(2)})`}
          </button>
        </div>
      </div>

      {/* Seller Operating Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="text-amber-600" size={20} />
              Log Operating Expense (Seller Shift)
            </h3>
            <p className="text-xs text-gray-500">Record daily shop operating costs (transport, utilities, rent, etc.).</p>
            
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
                  min="0.01"
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
                  placeholder="e.g. Taxi transport for stock delivery"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                  rows={2}
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700"
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

export default SalesInterface;

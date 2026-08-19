import React, { useState, useEffect } from 'react';
import { ShoppingCart, Receipt, User, Plus, Minus, Trash2, Percent } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { generateSaleReceipt } from './PDFGenerator';
import { useToast } from "@/hooks/use-toast";
import { getTaxSettings, TaxSettings } from '../lib/taxSettings';

interface Product {
  id: string;
  code?: string;
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

const SalesInterface = () => {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [initialDeposit, setInitialDeposit] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVatExempt, setIsVatExempt] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: true,
    vatRate: 15,
    incomeTaxRate: 35,
  });

  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
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
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchProductsAndTax();
  }, []);

  const addToCart = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingCartItem = cart.find(item => item.product.id === selectedProduct);

    if (existingCartItem) {
      if (existingCartItem.quantity + quantity > product.stock) {
        toast({
          title: "Error",
          description: "Not enough stock available",
          variant: "destructive"
        });
        return;
      }
      setCart(cart.map(item =>
        item.product.id === selectedProduct
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      if (quantity > product.stock) {
        toast({
          title: "Error",
          description: "Not enough stock available",
          variant: "destructive"
        });
        return;
      }
      setCart([...cart, { product, quantity }]);
    }

    setSelectedProduct('');
    setQuantity(1);
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
          buyerName: buyerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim(),
          sellerId: userProfile.uid,
          sellerName: userProfile.name,
          paymentMethod,
          timestamp: saleTimestamp,
          date: saleTimestamp.toISOString().split('T')[0]
        });

        const productRef = doc(db, 'products', cartItem.product.id);
        await updateDoc(productRef, {
          stock: cartItem.product.stock - cartItem.quantity
        });
      }

      // Record Accounts Receivable if paymentMethod is 'Loan / Credit'
      if (paymentMethod === 'Loan / Credit') {
        const paidNow = Math.min(initialDeposit || 0, cartGrandTotal);
        const remaining = cartGrandTotal - paidNow;
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

      generateSaleReceipt({
        items: cart.map(item => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity
        })),
        buyerName: buyerName || 'Walk-in Customer',
        timestamp: saleTimestamp,
        subtotal: cartSubtotal,
        vatRate: activeVatRate,
        vatAmount: cartVatAmount,
        totalAmount: cartGrandTotal
      }, userProfile);

      setCart([]);
      setBuyerName('');
      setCustomerPhone('');
      setInitialDeposit(0);

      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);

      toast({
        title: "Success",
        description: paymentMethod === 'Loan / Credit'
          ? "Credit sale processed & receivable recorded!"
          : "Sale processed successfully and receipt generated!"
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

  const selectedProductData = products.find(p => p.id === selectedProduct);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center mb-6">
        <ShoppingCart className="text-blue-600 mr-3" size={24} />
        <h3 className="text-lg font-semibold text-gray-900">Process Sale</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Choose a product...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.code ? `[${product.code}] ` : ''}{product.name} - Br {product.price} (Stock: {product.stock})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              max={selectedProductData?.stock || 1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addToCart}
              disabled={!selectedProduct}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-medium"
            >
              <Plus size={16} className="mr-1" />
              Add
            </button>
          </div>

          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

        {cart.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Shopping Cart</h4>
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between bg-white p-2 rounded">
                  <div className="flex-1">
                    <span className="font-medium">{item.product.name}</span>
                    <span className="text-sm text-gray-600 ml-2">Br {item.product.price}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="px-2">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                    >
                      <Trash2 size={12} />
                    </button>
                    <span className="font-semibold min-w-[60px] text-right">
                      Br {(item.product.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}

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
    </div>
  );
};

export default SalesInterface;

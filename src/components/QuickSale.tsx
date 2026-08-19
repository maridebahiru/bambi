import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Package, Filter, Plus, Minus, Trash2 } from 'lucide-react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { generateSaleReceipt } from './PDFGenerator';

interface Product {
  id: string;
  code?: string;
  name: string;
  price: number;
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
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const categories = [
    'Mobiles', 'Smart Phones', 'Non-Smart Phones', 'Laptops',
    'Computers & Desktops', 'Mobile Accessories', 'Glasses',
    'Covers', 'Chargers', 'Electrical Tools'
  ];

  const paymentMethods = ['Cash', 'Loan / Credit', 'CBE Mobile Banking', 'Telebirr', 'Amhara Bank', 'Awash Bank', 'Wegagen Bank', 'Oromia Bank', 'Abisiniya Bank', 'Other'];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory]);

  const fetchProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData.filter(p => p.stock > 0));
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
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

  const handleSale = async () => {
    if (cart.length === 0 || !userProfile) return;

    setLoading(true);
    try {
      const saleTimestamp = new Date();

      for (const cartItem of cart) {
        const totalPrice = cartItem.product.price * cartItem.quantity;

        await addDoc(collection(db, 'sales'), {
          productId: cartItem.product.id,
          productName: cartItem.product.name,
          category: cartItem.product.category,
          quantity: cartItem.quantity,
          unitPrice: cartItem.product.price,
          totalPrice,
          buyerName: buyerName || 'Walk-in Customer',
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
        items: cart.map(item => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.product.price * item.quantity
        })),
        buyerName: buyerName || 'Walk-in Customer',
        timestamp: saleTimestamp,
        totalAmount: cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0),
        paymentMethod
      }, userProfile);

      setCart([]);
      setBuyerName('');
      fetchProducts();

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

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Product Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <Package className="text-blue-600 mr-3" size={24} />
          <h3 className="text-lg font-semibold text-gray-900">Available Products</h3>
        </div>

        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
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

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredProducts.map((product) => (
            <div key={product.id} className="p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium flex items-center gap-1.5">
                    {product.code && (
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-gray-100 border text-gray-600 rounded">
                        {product.code}
                      </span>
                    )}
                    <span>{product.name}</span>
                  </h4>
                  <p className="text-sm text-gray-500">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${product.price}</p>
                  <p className="text-sm text-gray-500">Stock: {product.stock}</p>
                  <button
                    onClick={() => addToCart(product)}
                    className="mt-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products found matching your criteria
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center mb-4">
          <ShoppingCart className="text-green-600 mr-3" size={24} />
          <h3 className="text-lg font-semibold">Cart & Checkout</h3>
        </div>

        {cart.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
              <h4 className="font-medium mb-3">Items in Cart</h4>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between bg-white p-2 rounded">
                    <div className="flex-1">
                      <span className="font-medium text-sm">{item.product.name}</span>
                      <span className="text-xs text-gray-600 block">${item.product.price} each</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1 bg-gray-200 rounded">
                        <Minus size={10} />
                      </button>
                      <span className="px-2 text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1 bg-gray-200 rounded">
                        <Plus size={10} />
                      </button>
                      <button onClick={() => removeFromCart(item.product.id)} className="p-1 bg-red-100 text-red-600 rounded ml-1">
                        <Trash2 size={10} />
                      </button>
                      <span className="font-semibold text-sm min-w-[50px] text-right">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Customer Name (Optional)</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Amount:</span>
                <span className="text-xl font-bold text-blue-600">${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleSale}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center justify-center"
            >
              <ShoppingCart size={16} className="mr-2" />
              {loading ? 'Processing Sale...' : 'Complete Sale & Generate Receipt'}
            </button>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Package size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Add products to cart to process a sale</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickSale;

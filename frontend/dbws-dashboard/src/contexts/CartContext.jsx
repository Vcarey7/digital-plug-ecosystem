import React, { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};

// Cart items: { id, domain, kind: 'dns' | 'onchain', years, priceLabel, ...kind-specific pricing }
export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const addItem = useCallback((item) => {
    setItems((prev) => {
      if (prev.some((i) => i.domain === item.domain && i.kind === item.kind)) return prev;
      return [...prev, { id: `${item.kind}:${item.domain}:${Date.now()}`, ...item }];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateItem, clear }}>
      {children}
    </CartContext.Provider>
  );
};

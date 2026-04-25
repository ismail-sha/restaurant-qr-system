import React, { createContext, useContext, useReducer } from 'react';

const CartContext = createContext(null);

const initialState = { items: {}, notes: '' };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const prev = state.items[action.item.id] || { ...action.item, quantity: 0 };
      return { ...state, items: { ...state.items, [action.item.id]: { ...prev, quantity: prev.quantity + 1 } } };
    }
    case 'REMOVE': {
      const prev = state.items[action.id];
      if (!prev) return state;
      if (prev.quantity <= 1) {
        const { [action.id]: _, ...rest } = state.items;
        return { ...state, items: rest };
      }
      return { ...state, items: { ...state.items, [action.id]: { ...prev, quantity: prev.quantity - 1 } } };
    }
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = (item) => dispatch({ type: 'ADD', item });
  const removeItem = (id) => dispatch({ type: 'REMOVE', id });
  const setNotes = (notes) => dispatch({ type: 'SET_NOTES', notes });
  const clearCart = () => dispatch({ type: 'CLEAR' });

  const cartItems = Object.values(state.items);
  const totalCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, cartItems, notes: state.notes, totalCount, totalAmount, addItem, removeItem, setNotes, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

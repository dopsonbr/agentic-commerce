import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CartState } from './cart.state';
import { selectAllProducts } from '../products/products.selectors';

export const selectCartState = createFeatureSelector<CartState>('cart');

export const selectCart = createSelector(selectCartState, (state) => state.cart);

export const selectCartId = createSelector(selectCart, (cart) => cart?.id ?? null);

export const selectCustomerId = createSelector(
  selectCartState,
  (state) => state.customerId
);

export const selectCartItems = createSelector(
  selectCart,
  (cart) => cart?.items ?? []
);

export const selectCartItemCount = createSelector(selectCartItems, (items) =>
  items.reduce((total, item) => total + item.quantity, 0)
);

export const selectCartLoading = createSelector(
  selectCartState,
  (state) => state.loading
);

export const selectCartError = createSelector(
  selectCartState,
  (state) => state.error
);

export const selectCartItemsWithProducts = createSelector(
  selectCartItems,
  selectAllProducts,
  (items, products) =>
    items.map((item) => {
      const product = products.find((p) => p.sku === item.sku);
      return {
        ...item,
        product,
        lineTotal: product ? product.price * item.quantity : 0,
      };
    })
);

export const selectCartTotal = createSelector(
  selectCartItemsWithProducts,
  (items) => items.reduce((total, item) => total + item.lineTotal, 0)
);

import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ProductsState } from './products.state';

export const selectProductsState = createFeatureSelector<ProductsState>('products');

export const selectAllProducts = createSelector(
  selectProductsState,
  (state) => state.products
);

export const selectSelectedProduct = createSelector(
  selectProductsState,
  (state) => state.selectedProduct
);

export const selectProductsLoading = createSelector(
  selectProductsState,
  (state) => state.loading
);

export const selectProductsError = createSelector(
  selectProductsState,
  (state) => state.error
);

export const selectSearchQuery = createSelector(
  selectProductsState,
  (state) => state.searchQuery
);

export const selectProductsByCategory = (category: string) =>
  createSelector(selectAllProducts, (products) =>
    products.filter((p) => p.category === category)
  );

export const selectProductBySku = (sku: string) =>
  createSelector(selectAllProducts, (products) =>
    products.find((p) => p.sku === sku) ?? null
  );

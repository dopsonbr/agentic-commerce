import { createReducer, on } from '@ngrx/store';
import { initialProductsState } from './products.state';
import {
  loadProducts,
  loadProductsSuccess,
  loadProductsFailure,
  searchProducts,
  searchProductsSuccess,
  searchProductsFailure,
  loadProduct,
  loadProductSuccess,
  loadProductFailure,
  clearSelectedProduct,
} from './products.actions';

export const productsReducer = createReducer(
  initialProductsState,

  on(loadProducts, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(loadProductsSuccess, (state, { products }) => ({
    ...state,
    products,
    loading: false,
    error: null,
  })),
  on(loadProductsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(searchProducts, (state, { query }) => ({
    ...state,
    loading: true,
    error: null,
    searchQuery: query,
  })),
  on(searchProductsSuccess, (state, { products }) => ({
    ...state,
    products,
    loading: false,
    error: null,
  })),
  on(searchProductsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(loadProduct, (state) => ({
    ...state,
    loading: true,
    error: null,
    selectedProduct: null,
  })),
  on(loadProductSuccess, (state, { product }) => ({
    ...state,
    selectedProduct: product,
    loading: false,
    error: null,
  })),
  on(loadProductFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(clearSelectedProduct, (state) => ({
    ...state,
    selectedProduct: null,
  }))
);

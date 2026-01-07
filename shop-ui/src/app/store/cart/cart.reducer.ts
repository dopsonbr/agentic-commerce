import { createReducer, on } from '@ngrx/store';
import { initialCartState } from './cart.state';
import {
  setCustomerId,
  createCart,
  createCartSuccess,
  createCartFailure,
  loadCart,
  loadCartSuccess,
  loadCartFailure,
  addItem,
  addItemSuccess,
  addItemFailure,
  updateItem,
  updateItemSuccess,
  updateItemFailure,
  removeItem,
  removeItemSuccess,
  removeItemFailure,
} from './cart.actions';

export const cartReducer = createReducer(
  initialCartState,

  on(setCustomerId, (state, { customerId }) => ({
    ...state,
    customerId,
  })),

  on(createCart, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(createCartSuccess, (state, { cart }) => ({
    ...state,
    cart,
    customerId: cart.customerId,
    loading: false,
    error: null,
  })),
  on(createCartFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(loadCart, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(loadCartSuccess, (state, { cart }) => ({
    ...state,
    cart,
    loading: false,
    error: null,
  })),
  on(loadCartFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(addItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(addItemSuccess, (state, { cart }) => ({
    ...state,
    cart,
    loading: false,
    error: null,
  })),
  on(addItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(updateItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(updateItemSuccess, (state, { cart }) => ({
    ...state,
    cart,
    loading: false,
    error: null,
  })),
  on(updateItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  })),

  on(removeItem, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(removeItemSuccess, (state, { cart }) => ({
    ...state,
    cart,
    loading: false,
    error: null,
  })),
  on(removeItemFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error,
  }))
);

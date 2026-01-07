import { createAction, props } from '@ngrx/store';
import { Cart } from '../../models/cart.model';

export const setCustomerId = createAction(
  '[Cart] Set Customer ID',
  props<{ customerId: string }>()
);

export const createCart = createAction(
  '[Cart] Create Cart',
  props<{ customerId: string }>()
);
export const createCartSuccess = createAction(
  '[Cart] Create Cart Success',
  props<{ cart: Cart }>()
);
export const createCartFailure = createAction(
  '[Cart] Create Cart Failure',
  props<{ error: string }>()
);

export const loadCart = createAction(
  '[Cart] Load Cart',
  props<{ cartId: string; customerId: string }>()
);
export const loadCartSuccess = createAction(
  '[Cart] Load Cart Success',
  props<{ cart: Cart }>()
);
export const loadCartFailure = createAction(
  '[Cart] Load Cart Failure',
  props<{ error: string }>()
);

export const addItem = createAction(
  '[Cart] Add Item',
  props<{ sku: string; quantity: number }>()
);
export const addItemSuccess = createAction(
  '[Cart] Add Item Success',
  props<{ cart: Cart }>()
);
export const addItemFailure = createAction(
  '[Cart] Add Item Failure',
  props<{ error: string }>()
);

export const updateItem = createAction(
  '[Cart] Update Item',
  props<{ sku: string; quantity: number }>()
);
export const updateItemSuccess = createAction(
  '[Cart] Update Item Success',
  props<{ cart: Cart }>()
);
export const updateItemFailure = createAction(
  '[Cart] Update Item Failure',
  props<{ error: string }>()
);

export const removeItem = createAction(
  '[Cart] Remove Item',
  props<{ sku: string }>()
);
export const removeItemSuccess = createAction(
  '[Cart] Remove Item Success',
  props<{ cart: Cart }>()
);
export const removeItemFailure = createAction(
  '[Cart] Remove Item Failure',
  props<{ error: string }>()
);

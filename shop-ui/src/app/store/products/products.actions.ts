import { createAction, props } from '@ngrx/store';
import { Product } from '../../models/product.model';

export const loadProducts = createAction('[Products] Load Products');
export const loadProductsSuccess = createAction(
  '[Products] Load Products Success',
  props<{ products: Product[] }>()
);
export const loadProductsFailure = createAction(
  '[Products] Load Products Failure',
  props<{ error: string }>()
);

export const searchProducts = createAction(
  '[Products] Search Products',
  props<{ query: string }>()
);
export const searchProductsSuccess = createAction(
  '[Products] Search Products Success',
  props<{ products: Product[] }>()
);
export const searchProductsFailure = createAction(
  '[Products] Search Products Failure',
  props<{ error: string }>()
);

export const loadProduct = createAction(
  '[Products] Load Product',
  props<{ sku: string }>()
);
export const loadProductSuccess = createAction(
  '[Products] Load Product Success',
  props<{ product: Product }>()
);
export const loadProductFailure = createAction(
  '[Products] Load Product Failure',
  props<{ error: string }>()
);

export const clearSelectedProduct = createAction('[Products] Clear Selected Product');

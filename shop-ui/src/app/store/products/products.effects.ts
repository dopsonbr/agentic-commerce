import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of, debounceTime, switchMap } from 'rxjs';
import { ProductsService } from '../../services/products.service';
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
} from './products.actions';

@Injectable()
export class ProductsEffects {
  private readonly actions$ = inject(Actions);
  private readonly productsService = inject(ProductsService);

  loadProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadProducts),
      mergeMap(() =>
        this.productsService.getAll().pipe(
          map((products) => loadProductsSuccess({ products })),
          catchError((error) => of(loadProductsFailure({ error: error.message })))
        )
      )
    )
  );

  searchProducts$ = createEffect(() =>
    this.actions$.pipe(
      ofType(searchProducts),
      debounceTime(300),
      switchMap(({ query }) => {
        if (!query.trim()) {
          return this.productsService.getAll().pipe(
            map((products) => searchProductsSuccess({ products })),
            catchError((error) => of(searchProductsFailure({ error: error.message })))
          );
        }
        return this.productsService.search(query).pipe(
          map((products) => searchProductsSuccess({ products })),
          catchError((error) => of(searchProductsFailure({ error: error.message })))
        );
      })
    )
  );

  loadProduct$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadProduct),
      mergeMap(({ sku }) =>
        this.productsService.getBySku(sku).pipe(
          map((product) => loadProductSuccess({ product })),
          catchError((error) => of(loadProductFailure({ error: error.message })))
        )
      )
    )
  );
}

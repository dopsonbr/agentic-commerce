import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, map, mergeMap, of, withLatestFrom, switchMap } from 'rxjs';
import { CartService } from '../../services/cart.service';
import {
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
import { selectCart, selectCustomerId } from './cart.selectors';

@Injectable()
export class CartEffects {
  private readonly actions$ = inject(Actions);
  private readonly cartService = inject(CartService);
  private readonly store = inject(Store);

  createCart$ = createEffect(() =>
    this.actions$.pipe(
      ofType(createCart),
      mergeMap(({ customerId }) =>
        this.cartService.create(customerId).pipe(
          map((cart) => createCartSuccess({ cart })),
          catchError((error) => of(createCartFailure({ error: error.message })))
        )
      )
    )
  );

  loadCart$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadCart),
      mergeMap(({ cartId, customerId }) =>
        this.cartService.get(cartId, customerId).pipe(
          map((cart) => loadCartSuccess({ cart })),
          catchError((error) => of(loadCartFailure({ error: error.message })))
        )
      )
    )
  );

  addItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(addItem),
      withLatestFrom(this.store.select(selectCart), this.store.select(selectCustomerId)),
      switchMap(([{ sku, quantity }, cart, customerId]) => {
        if (!cart) {
          return this.cartService.create(customerId || 'guest').pipe(
            switchMap((newCart) =>
              this.cartService.addItem(newCart.id, sku, quantity).pipe(
                map((updatedCart) => addItemSuccess({ cart: updatedCart })),
                catchError((error) => of(addItemFailure({ error: error.message })))
              )
            ),
            catchError((error) => of(addItemFailure({ error: error.message })))
          );
        }
        return this.cartService.addItem(cart.id, sku, quantity).pipe(
          map((updatedCart) => addItemSuccess({ cart: updatedCart })),
          catchError((error) => of(addItemFailure({ error: error.message })))
        );
      })
    )
  );

  updateItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(updateItem),
      withLatestFrom(this.store.select(selectCart)),
      mergeMap(([{ sku, quantity }, cart]) => {
        if (!cart) {
          return of(updateItemFailure({ error: 'No cart found' }));
        }
        return this.cartService.updateItem(cart.id, sku, quantity).pipe(
          map((updatedCart) => updateItemSuccess({ cart: updatedCart })),
          catchError((error) => of(updateItemFailure({ error: error.message })))
        );
      })
    )
  );

  removeItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(removeItem),
      withLatestFrom(this.store.select(selectCart)),
      mergeMap(([{ sku }, cart]) => {
        if (!cart) {
          return of(removeItemFailure({ error: 'No cart found' }));
        }
        return this.cartService.removeItem(cart.id, sku).pipe(
          map((updatedCart) => removeItemSuccess({ cart: updatedCart })),
          catchError((error) => of(removeItemFailure({ error: error.message })))
        );
      })
    )
  );
}

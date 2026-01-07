import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CurrencyPipe } from '@angular/common';
import { Header } from '../../shared/header/header';
import { QuantityInput } from '../../shared/quantity-input/quantity-input';
import { loadProducts } from '../../store/products/products.actions';
import { updateItem, removeItem } from '../../store/cart/cart.actions';
import {
  selectCartItemsWithProducts,
  selectCartTotal,
  selectCartLoading,
  selectCartError,
} from '../../store/cart/cart.selectors';

@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, QuantityInput, RouterLink, CurrencyPipe],
  template: `
    <app-header />
    <main class="container">
      <h1>Shopping Cart</h1>

      @if (loading()) {
        <p class="loading">Loading cart...</p>
      }

      @if (error()) {
        <p class="error">Error: {{ error() }}</p>
      }

      @if (items().length === 0 && !loading()) {
        <div class="empty-cart">
          <p>Your cart is empty.</p>
          <a routerLink="/products" class="continue-shopping">Continue Shopping</a>
        </div>
      }

      @if (items().length > 0) {
        <div class="cart-items">
          @for (item of items(); track item.sku) {
            <article class="cart-item">
              <div class="item-image">
                @if (item.product) {
                  <img [src]="item.product.imageUrl" [alt]="item.product.name" />
                }
              </div>
              <div class="item-details">
                @if (item.product) {
                  <h2 class="item-name">{{ item.product.name }}</h2>
                  <p class="item-price">{{ item.product.price | currency }}</p>
                } @else {
                  <h2 class="item-name">SKU: {{ item.sku }}</h2>
                  <p class="item-price">Price unavailable</p>
                }
              </div>
              <div class="item-quantity">
                <app-quantity-input
                  [value]="item.quantity"
                  [min]="1"
                  [max]="item.product?.inventory ?? 99"
                  (valueChange)="updateQuantity(item.sku, $event)"
                />
              </div>
              <div class="item-total">
                {{ item.lineTotal | currency }}
              </div>
              <button
                class="remove-btn"
                (click)="removeFromCart(item.sku)"
                aria-label="Remove item from cart"
              >
                &times;
              </button>
            </article>
          }
        </div>

        <div class="cart-summary">
          <div class="cart-total">
            <span>Total:</span>
            <span class="total-amount">{{ total() | currency }}</span>
          </div>
          <a routerLink="/products" class="continue-shopping">Continue Shopping</a>
        </div>
      }
    </main>
  `,
  styles: `
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem 2rem;
    }
    h1 {
      margin-bottom: 1.5rem;
    }
    .loading,
    .error {
      text-align: center;
      padding: 2rem;
    }
    .error {
      color: var(--color-error, #e74c3c);
    }
    .empty-cart {
      text-align: center;
      padding: 3rem;
    }
    .continue-shopping {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: var(--color-primary, #333);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 1rem;
    }
    .continue-shopping:hover {
      background: var(--color-primary-dark, #222);
    }
    .cart-items {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cart-item {
      display: grid;
      grid-template-columns: 80px 1fr auto auto auto;
      gap: 1rem;
      align-items: center;
      padding: 1rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 8px;
      background: white;
    }
    @media (max-width: 600px) {
      .cart-item {
        grid-template-columns: 60px 1fr;
        grid-template-rows: auto auto;
      }
      .item-quantity,
      .item-total {
        grid-column: 2;
      }
      .remove-btn {
        grid-column: 1 / -1;
        justify-self: end;
      }
    }
    .item-image {
      width: 80px;
      height: 80px;
      background: var(--color-bg-secondary, #f5f5f5);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-image img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .item-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .item-name {
      font-size: 1rem;
      margin: 0;
    }
    .item-price {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #666);
      margin: 0;
    }
    .item-total {
      font-weight: bold;
      min-width: 80px;
      text-align: right;
    }
    .remove-btn {
      width: 2rem;
      height: 2rem;
      border: none;
      background: transparent;
      color: var(--color-error, #e74c3c);
      font-size: 1.5rem;
      cursor: pointer;
      border-radius: 50%;
    }
    .remove-btn:hover {
      background: var(--color-bg-secondary, #f5f5f5);
    }
    .cart-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 2px solid var(--color-border, #ddd);
    }
    .cart-total {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .total-amount {
      font-size: 1.5rem;
      font-weight: bold;
    }
  `,
})
export class CartComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly items = this.store.selectSignal(selectCartItemsWithProducts);
  protected readonly total = this.store.selectSignal(selectCartTotal);
  protected readonly loading = this.store.selectSignal(selectCartLoading);
  protected readonly error = this.store.selectSignal(selectCartError);

  ngOnInit(): void {
    this.store.dispatch(loadProducts());
  }

  protected updateQuantity(sku: string, quantity: number): void {
    this.store.dispatch(updateItem({ sku, quantity }));
  }

  protected removeFromCart(sku: string): void {
    this.store.dispatch(removeItem({ sku }));
  }
}

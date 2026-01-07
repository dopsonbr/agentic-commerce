import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { Header } from '../../shared/header/header';
import { QuantityInput } from '../../shared/quantity-input/quantity-input';
import { loadProduct, clearSelectedProduct } from '../../store/products/products.actions';
import { addItem } from '../../store/cart/cart.actions';
import {
  selectSelectedProduct,
  selectProductsLoading,
  selectProductsError,
} from '../../store/products/products.selectors';

@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, QuantityInput, RouterLink],
  template: `
    <app-header />
    <main class="container">
      <a routerLink="/products" class="back-link">&larr; Back to Products</a>

      @if (loading()) {
        <p class="loading">Loading product...</p>
      }

      @if (error()) {
        <p class="error">Error: {{ error() }}</p>
      }

      @if (product(); as p) {
        <article class="product-detail">
          <div class="product-image">
            <img [src]="p.imageUrl" [alt]="p.name" />
          </div>
          <div class="product-info">
            <p class="product-category">{{ p.category }}</p>
            <h1 class="product-name">{{ p.name }}</h1>
            <p class="product-description">{{ p.description }}</p>
            <p class="product-price">\${{ p.price.toFixed(2) }}</p>
            <p class="product-inventory">
              @if (p.inventory > 0) {
                <span class="in-stock">In Stock ({{ p.inventory }} available)</span>
              } @else {
                <span class="out-of-stock">Out of Stock</span>
              }
            </p>

            <div class="add-to-cart">
              <label for="quantity">Quantity:</label>
              <app-quantity-input
                [value]="quantity()"
                [min]="1"
                [max]="p.inventory"
                (valueChange)="quantity.set($event)"
              />
              <button
                class="add-to-cart-btn"
                [disabled]="p.inventory === 0"
                (click)="addToCart()"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </article>
      }
    </main>
  `,
  styles: `
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 1rem 2rem;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 1.5rem;
      color: var(--color-primary, #333);
      text-decoration: none;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    .loading,
    .error {
      text-align: center;
      padding: 2rem;
    }
    .error {
      color: var(--color-error, #e74c3c);
    }
    .product-detail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 768px) {
      .product-detail {
        grid-template-columns: 1fr;
      }
    }
    .product-image {
      aspect-ratio: 1;
      background: var(--color-bg-secondary, #f5f5f5);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .product-image img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .product-info {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .product-category {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #666);
      margin: 0;
    }
    .product-name {
      font-size: 1.75rem;
      margin: 0;
    }
    .product-description {
      color: var(--color-text-secondary, #666);
      line-height: 1.6;
      margin: 0;
    }
    .product-price {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--color-primary, #333);
      margin: 0;
    }
    .product-inventory {
      margin: 0;
    }
    .in-stock {
      color: var(--color-success, #27ae60);
    }
    .out-of-stock {
      color: var(--color-error, #e74c3c);
    }
    .add-to-cart {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 1rem;
    }
    .add-to-cart-btn {
      padding: 0.75rem 1.5rem;
      background: var(--color-primary, #333);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    .add-to-cart-btn:hover:not(:disabled) {
      background: var(--color-primary-dark, #222);
    }
    .add-to-cart-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class ProductDetail implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);

  protected readonly product = this.store.selectSignal(selectSelectedProduct);
  protected readonly loading = this.store.selectSignal(selectProductsLoading);
  protected readonly error = this.store.selectSignal(selectProductsError);
  protected readonly quantity = signal(1);

  ngOnInit(): void {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (sku) {
      this.store.dispatch(loadProduct({ sku }));
    }
  }

  protected addToCart(): void {
    const product = this.product();
    if (product) {
      this.store.dispatch(addItem({ sku: product.sku, quantity: this.quantity() }));
    }
  }
}

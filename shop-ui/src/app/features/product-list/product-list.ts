import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Header } from '../../shared/header/header';
import { loadProducts, searchProducts } from '../../store/products/products.actions';
import { setCustomerId, addItem } from '../../store/cart/cart.actions';
import {
  selectAllProducts,
  selectProductsLoading,
  selectProductsError,
} from '../../store/products/products.selectors';
import { selectCustomerId } from '../../store/cart/cart.selectors';

@Component({
  selector: 'app-product-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, RouterLink, FormsModule],
  template: `
    <app-header />
    <main class="container">
      <h1>Products</h1>

      <div class="controls">
        <div class="search-box">
          <label for="search" class="visually-hidden">Search products</label>
          <input
            id="search"
            type="text"
            placeholder="Search products..."
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearch($event)"
            class="search-input"
          />
        </div>
        <div class="customer-box">
          <label for="customerId">Customer ID:</label>
          <input
            id="customerId"
            type="text"
            placeholder="Enter your ID"
            [ngModel]="customerId()"
            (ngModelChange)="onCustomerIdChange($event)"
            class="customer-input"
          />
        </div>
      </div>

      @if (loading()) {
        <p class="loading">Loading products...</p>
      }

      @if (error()) {
        <p class="error">Error: {{ error() }}</p>
      }

      @if (!loading() && products().length === 0) {
        <p class="empty">No products found.</p>
      }

      <div class="product-grid">
        @for (product of products(); track product.sku) {
          <article class="product-card">
            <div class="product-image">
              <img [src]="product.imageUrl" [alt]="product.name" />
            </div>
            <div class="product-info">
              <h2 class="product-name">
                <a [routerLink]="['/products', product.sku]">{{ product.name }}</a>
              </h2>
              <p class="product-category">{{ product.category }}</p>
              <p class="product-price">\${{ product.price.toFixed(2) }}</p>
              <button class="add-to-cart-btn" (click)="addToCart(product.sku)">
                Add to Cart
              </button>
            </div>
          </article>
        }
      </div>
    </main>
  `,
  styles: `
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 2rem;
    }
    h1 {
      margin-bottom: 1.5rem;
    }
    .controls {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .search-box,
    .customer-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .search-input,
    .customer-input {
      padding: 0.5rem 1rem;
      font-size: 1rem;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 4px;
      min-width: 200px;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .loading,
    .error,
    .empty {
      text-align: center;
      padding: 2rem;
    }
    .error {
      color: var(--color-error, #e74c3c);
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
    }
    .product-card {
      border: 1px solid var(--color-border, #ddd);
      border-radius: 8px;
      overflow: hidden;
      background: white;
    }
    .product-image {
      aspect-ratio: 4/3;
      background: var(--color-bg-secondary, #f5f5f5);
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
      padding: 1rem;
    }
    .product-name {
      font-size: 1rem;
      margin: 0 0 0.5rem 0;
    }
    .product-name a {
      color: inherit;
      text-decoration: none;
    }
    .product-name a:hover {
      color: var(--color-primary, #333);
      text-decoration: underline;
    }
    .product-category {
      font-size: 0.875rem;
      color: var(--color-text-secondary, #666);
      margin: 0 0 0.5rem 0;
    }
    .product-price {
      font-size: 1.25rem;
      font-weight: bold;
      color: var(--color-primary, #333);
      margin: 0 0 1rem 0;
    }
    .add-to-cart-btn {
      width: 100%;
      padding: 0.75rem;
      background: var(--color-primary, #333);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    .add-to-cart-btn:hover {
      background: var(--color-primary-dark, #222);
    }
  `,
})
export class ProductList implements OnInit {
  private readonly store = inject(Store);

  protected readonly products = this.store.selectSignal(selectAllProducts);
  protected readonly loading = this.store.selectSignal(selectProductsLoading);
  protected readonly error = this.store.selectSignal(selectProductsError);
  protected readonly customerId = this.store.selectSignal(selectCustomerId);
  protected readonly searchQuery = signal('');

  ngOnInit(): void {
    this.store.dispatch(loadProducts());
  }

  protected onSearch(query: string): void {
    this.searchQuery.set(query);
    this.store.dispatch(searchProducts({ query }));
  }

  protected onCustomerIdChange(customerId: string): void {
    this.store.dispatch(setCustomerId({ customerId }));
  }

  protected addToCart(sku: string): void {
    this.store.dispatch(addItem({ sku, quantity: 1 }));
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectCartItemCount } from '../../store/cart/cart.selectors';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="header">
      <a routerLink="/products" class="logo">Shop</a>
      <nav class="nav">
        <a routerLink="/products" class="nav-link">Products</a>
        <a routerLink="/cart" class="nav-link cart-link">
          Cart
          @if (cartItemCount() > 0) {
            <span class="cart-badge">{{ cartItemCount() }}</span>
          }
        </a>
      </nav>
    </header>
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      background: var(--color-primary, #333);
      color: white;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: bold;
      color: white;
      text-decoration: none;
    }
    .nav {
      display: flex;
      gap: 1.5rem;
    }
    .nav-link {
      color: white;
      text-decoration: none;
      position: relative;
    }
    .nav-link:hover {
      text-decoration: underline;
    }
    .cart-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .cart-badge {
      background: var(--color-accent, #e74c3c);
      color: white;
      border-radius: 50%;
      padding: 0.2rem 0.5rem;
      font-size: 0.75rem;
      min-width: 1.25rem;
      text-align: center;
    }
  `,
})
export class Header {
  private readonly store = inject(Store);
  protected readonly cartItemCount = this.store.selectSignal(selectCartItemCount);
}

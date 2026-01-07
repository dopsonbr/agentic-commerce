import { Routes } from '@angular/router';
import { ProductList } from './features/product-list/product-list';
import { ProductDetail } from './features/product-detail/product-detail';
import { CartComponent } from './features/cart/cart';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  { path: 'products', component: ProductList },
  { path: 'products/:sku', component: ProductDetail },
  { path: 'cart', component: CartComponent },
];

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Cart } from '../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/cart';

  create(customerId: string): Observable<Cart> {
    return this.http.post<Cart>(this.baseUrl, { customerId });
  }

  get(cartId: string, customerId: string): Observable<Cart> {
    return this.http.get<Cart>(`${this.baseUrl}/${cartId}?customerId=${encodeURIComponent(customerId)}`);
  }

  addItem(cartId: string, sku: string, quantity: number): Observable<Cart> {
    return this.http.post<Cart>(`${this.baseUrl}/${cartId}/items`, { sku, quantity });
  }

  updateItem(cartId: string, sku: string, quantity: number): Observable<Cart> {
    return this.http.put<Cart>(`${this.baseUrl}/${cartId}/items/${sku}`, { quantity });
  }

  removeItem(cartId: string, sku: string): Observable<Cart> {
    return this.http.delete<Cart>(`${this.baseUrl}/${cartId}/items/${sku}`);
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/products';

  getAll(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  search(query: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}?search=${encodeURIComponent(query)}`);
  }

  getBySku(sku: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${sku}`);
  }
}

export interface CartItem {
  sku: string;
  quantity: number;
}

export interface Cart {
  id: string;
  customerId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  sku: string;
  name: string;
  price: number;
  description: string;
  category: string;
  inventory: number;
  imageUrl: string;
}

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

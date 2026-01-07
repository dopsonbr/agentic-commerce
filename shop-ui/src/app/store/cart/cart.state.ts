import { Cart } from '../../models/cart.model';

export interface CartState {
  cart: Cart | null;
  customerId: string;
  loading: boolean;
  error: string | null;
}

export const initialCartState: CartState = {
  cart: null,
  customerId: '',
  loading: false,
  error: null,
};

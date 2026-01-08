import { z } from 'zod';
import { ProductSchema, CartItemSchema } from '../types.js';

// search_products
export const searchProductsInput = z.object({
  query: z.string().describe('Search term for products'),
  limit: z.number().optional().default(10).describe('Maximum results to return'),
});

export const searchProductsOutput = z.object({
  products: z.array(ProductSchema),
  total: z.number(),
});

// get_product_details
export const getProductDetailsInput = z.object({
  sku: z.string().describe('Product SKU'),
});

export const getProductDetailsOutput = ProductSchema;

// add_to_cart
export const addToCartInput = z.object({
  sku: z.string().describe('Product SKU to add'),
  quantity: z.number().optional().default(1).describe('Quantity to add'),
});

export const addToCartOutput = z.object({
  success: z.boolean(),
  cartId: z.string(),
  item: CartItemSchema,
});

// get_cart
export const getCartInput = z.object({});

export const getCartOutput = z.object({
  cartId: z.string(),
  customerId: z.string().nullable(),
  items: z.array(CartItemSchema),
  total: z.number(),
});

// set_customer_id
export const setCustomerIdInput = z.object({
  customerId: z.string().describe('Customer ID to set for session'),
});

export const setCustomerIdOutput = z.object({
  success: z.boolean(),
  customerId: z.string(),
});

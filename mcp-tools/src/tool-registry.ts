import type { ToolDefinition } from './types.js';
import * as schemas from './schemas/tools.js';
import { handleSearchProducts } from './handlers/search-products.js';
import { handleGetProductDetails } from './handlers/get-product-details.js';
import { handleGetCart } from './handlers/get-cart.js';
import { handleAddToCart } from './handlers/add-to-cart.js';
import { handleSetCustomerId } from './handlers/set-customer-id.js';

export const tools: ToolDefinition[] = [
  {
    name: 'search_products',
    description: 'Search for products by keyword. Returns matching products with details.',
    inputSchema: schemas.searchProductsInput,
    handler: handleSearchProducts,
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product by SKU.',
    inputSchema: schemas.getProductDetailsInput,
    handler: handleGetProductDetails,
  },
  {
    name: 'get_cart',
    description: 'Get the current shopping cart contents and total.',
    inputSchema: schemas.getCartInput,
    handler: handleGetCart,
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to the shopping cart. Requires product SKU.',
    inputSchema: schemas.addToCartInput,
    handler: handleAddToCart,
  },
  {
    name: 'set_customer_id',
    description: 'Set the customer ID for this chat session.',
    inputSchema: schemas.setCustomerIdInput,
    handler: handleSetCustomerId,
  },
];

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find(t => t.name === name);
}

export function listTools() {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/**
 * Maps high-level operations to their NgRx action types.
 * Used by headless-session-manager to know which actions to dispatch and await.
 */
export const ACTION_MAPPINGS = {
  // Cart operations
  addToCart: {
    trigger: '[Cart] Add Item',
    success: ['[Cart] Add Item Success'],
    failure: ['[Cart] Add Item Failure'],
  },
  removeFromCart: {
    trigger: '[Cart] Remove Item',
    success: ['[Cart] Remove Item Success'],
    failure: ['[Cart] Remove Item Failure'],
  },
  updateCartItem: {
    trigger: '[Cart] Update Item',
    success: ['[Cart] Update Item Success'],
    failure: ['[Cart] Update Item Failure'],
  },
  createCart: {
    trigger: '[Cart] Create Cart',
    success: ['[Cart] Create Cart Success'],
    failure: ['[Cart] Create Cart Failure'],
  },
  loadCart: {
    trigger: '[Cart] Load Cart',
    success: ['[Cart] Load Cart Success'],
    failure: ['[Cart] Load Cart Failure'],
  },
  setCustomerId: {
    trigger: '[Cart] Set Customer ID',
    success: ['[Cart] Set Customer ID'], // Synchronous action, no separate success
    failure: [],
  },

  // Product operations
  loadProducts: {
    trigger: '[Products] Load Products',
    success: ['[Products] Load Products Success'],
    failure: ['[Products] Load Products Failure'],
  },
  searchProducts: {
    trigger: '[Products] Search Products',
    success: ['[Products] Search Products Success'],
    failure: ['[Products] Search Products Failure'],
  },
  loadProduct: {
    trigger: '[Products] Load Product',
    success: ['[Products] Load Product Success'],
    failure: ['[Products] Load Product Failure'],
  },
} as const;

export type ActionMappingKey = keyof typeof ACTION_MAPPINGS;

/**
 * Helper to get action mapping by key.
 */
export function getActionMapping(key: ActionMappingKey) {
  return ACTION_MAPPINGS[key];
}

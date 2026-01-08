import { getProductDetailsInput, getProductDetailsOutput } from '../schemas/tools.js';

const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleGetProductDetails(args: unknown, _sessionId: string) {
  const input = getProductDetailsInput.parse(args);

  const response = await fetch(`${SHOP_API_URL}/api/products/${input.sku}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Product not found: ${input.sku}`);
    }
    throw new Error(`shop-api error: ${response.status}`);
  }

  const product = await response.json();
  return getProductDetailsOutput.parse(product);
}

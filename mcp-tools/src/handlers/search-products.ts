import { searchProductsInput, searchProductsOutput } from '../schemas/tools.js';

const SHOP_API_URL = process.env['SHOP_API_URL'] || 'http://localhost:3000';

export async function handleSearchProducts(args: unknown, _sessionId: string) {
  const input = searchProductsInput.parse(args);

  const url = new URL('/api/products', SHOP_API_URL);
  if (input.query) {
    url.searchParams.set('search', input.query);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`shop-api error: ${response.status}`);
  }

  const products = await response.json();
  const productArray = Array.isArray(products) ? products : [];

  // Apply limit but report actual total matches
  const limited = productArray.slice(0, input.limit);

  return searchProductsOutput.parse({
    products: limited,
    total: productArray.length, // Total matches, not limited count
  });
}

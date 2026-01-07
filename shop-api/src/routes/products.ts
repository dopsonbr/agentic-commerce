import type { Product } from "../types.ts";
import { json } from "../cors.ts";
import productsData from "../data/products.json";

const products: Product[] = productsData;

export function listProducts(searchQuery?: string): Product[] {
  if (!searchQuery) {
    return products;
  }

  const query = searchQuery.toLowerCase();
  return products.filter(
    (p) =>
      p.sku.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query)
  );
}

export function getProduct(sku: string): Product | undefined {
  return products.find((p) => p.sku === sku);
}

export const productRoutes = {
  "/api/products": {
    GET: (req: Request) => {
      const url = new URL(req.url);
      const search = url.searchParams.get("search") ?? undefined;
      const results = listProducts(search);
      return json(results);
    },
  },
  "/api/products/:sku": {
    GET: (req: Request & { params: { sku: string } }) => {
      const product = getProduct(req.params.sku);
      if (!product) {
        return json({ error: "Product not found" }, { status: 404 });
      }
      return json(product);
    },
  },
};

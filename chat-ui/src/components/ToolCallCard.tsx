import type { ToolResultEvent } from '../types/events';
import { ProductCard } from './ProductCard';
import { CartCard } from './CartCard';

interface Props {
  toolName: string;
  args: Record<string, unknown>;
  result?: ToolResultEvent;
}

export function ToolCallCard({ toolName, args, result }: Props) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="text-xs text-gray-500 mb-2">
        Tool: <span className="font-mono">{toolName}</span>
        {Object.keys(args).length > 0 && (
          <span className="ml-2 text-gray-400">
            ({Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
          </span>
        )}
      </div>

      {result ? (
        result.success ? (
          <ToolResultRenderer toolName={toolName} result={result.result} />
        ) : (
          <div className="text-red-500">Error: {result.error}</div>
        )
      ) : (
        <div className="text-gray-400">Loading...</div>
      )}
    </div>
  );
}

function ToolResultRenderer({ toolName, result }: { toolName: string; result: unknown }) {
  switch (toolName) {
    case 'search_products': {
      const searchResult = result as { products: Array<{
        sku: string;
        name: string;
        description: string;
        price: number;
        category: string;
        inStock: boolean;
      }>; total: number };
      if (searchResult.products.length === 0) {
        return <div className="text-gray-500">No products found</div>;
      }
      return (
        <div className="space-y-2">
          {searchResult.products.map(product => (
            <ProductCard key={product.sku} product={product} />
          ))}
        </div>
      );
    }

    case 'get_product_details': {
      const product = result as {
        sku: string;
        name: string;
        description: string;
        price: number;
        category: string;
        inStock: boolean;
      };
      return <ProductCard product={product} />;
    }

    case 'add_to_cart': {
      const addResult = result as { success: boolean; item: { name: string; price: number; quantity: number } };
      return (
        <div className="text-green-600">
          Added {addResult.item.name} (${addResult.item.price.toFixed(2)}) x{addResult.item.quantity}
        </div>
      );
    }

    case 'get_cart': {
      const cart = result as {
        cartId: string;
        items: Array<{ sku: string; name: string; price: number; quantity: number }>;
        total: number;
      };
      return <CartCard cart={cart} />;
    }

    case 'set_customer_id': {
      const idResult = result as { customerId: string };
      return <div className="text-green-600">Customer ID set to {idResult.customerId}</div>;
    }

    default:
      return <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>;
  }
}

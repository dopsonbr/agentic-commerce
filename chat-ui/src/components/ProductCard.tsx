interface Props {
  product: {
    sku: string;
    name: string;
    description: string;
    price: number;
    category: string;
    inStock: boolean;
  };
}

export function ProductCard({ product }: Props) {
  return (
    <div className="border rounded p-3 bg-white">
      <div className="font-medium">{product.name}</div>
      <div className="text-sm text-gray-600">{product.description}</div>
      <div className="flex justify-between items-center mt-2">
        <span className="font-bold">${product.price.toFixed(2)}</span>
        <span className="text-xs text-gray-500">SKU: {product.sku}</span>
      </div>
      <div className={`text-xs mt-1 ${product.inStock ? 'text-green-600' : 'text-red-600'}`}>
        {product.inStock ? 'In Stock' : 'Out of Stock'}
      </div>
    </div>
  );
}

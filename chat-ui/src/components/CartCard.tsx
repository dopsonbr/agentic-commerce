interface Props {
  cart: {
    cartId: string;
    items: Array<{
      sku: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    total: number;
  };
}

export function CartCard({ cart }: Props) {
  if (cart.items.length === 0) {
    return <div className="text-gray-500">Your cart is empty</div>;
  }

  return (
    <div className="space-y-2">
      {cart.items.map(item => (
        <div key={item.sku} className="flex justify-between text-sm">
          <span>{item.name} x{item.quantity}</span>
          <span>${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      ))}
      <div className="border-t pt-2 flex justify-between font-bold">
        <span>Total</span>
        <span>${cart.total.toFixed(2)}</span>
      </div>
    </div>
  );
}

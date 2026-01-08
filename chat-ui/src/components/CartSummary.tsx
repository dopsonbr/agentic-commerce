import type { GetCartResult } from '../types/events';

interface Props {
  cart: GetCartResult | null;
}

export function CartSummary({ cart }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold mb-3">Cart</h3>

      {!cart || cart.items.length === 0 ? (
        <div className="text-gray-500 text-sm">Empty</div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {cart.items.map(item => (
              <div key={item.sku} className="text-sm flex justify-between">
                <span>{item.name} x{item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 font-bold flex justify-between">
            <span>Total</span>
            <span>${cart.total.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}

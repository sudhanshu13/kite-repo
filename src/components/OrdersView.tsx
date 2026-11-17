import { useMemo, useState } from 'react';
import { XCircle } from 'lucide-react';
import type { Order } from '../../shared/types.ts';
import { formatPrice, formatTime } from '../utils/format.ts';

interface OrdersViewProps {
  orders: Order[];
  onCancelOrder: (orderId: string) => Promise<void>;
}

export function OrdersView({ orders, onCancelOrder }: OrdersViewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const openOrders = useMemo(
    () =>
      orders.filter((o) => o.status === 'OPEN' || o.status === 'TRIGGER PENDING'),
    [orders],
  );
  const completedOrders = useMemo(
    () =>
      orders.filter((o) => o.status !== 'OPEN' && o.status !== 'TRIGGER PENDING'),
    [orders],
  );

  async function handleCancel(orderId: string) {
    setCancellingId(orderId);
    try {
      await onCancelOrder(orderId);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-8">
      {/* Open Orders */}
      <section aria-labelledby="open-orders-heading">
        <h1
          id="open-orders-heading"
          className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0] mb-3 pb-2 border-b border-[#EEEEEE] dark:border-[#282828]"
        >
          Open orders ({openOrders.length})
        </h1>

        {openOrders.length === 0 ? (
          <div className="py-8 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded text-xs text-[#9B9B9B]">
            No pending limit or stop-loss orders. Place a LIMIT or SL order from the Marketwatch to test automated tick matching.
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                  <th className="py-2.5 px-3 font-normal">Time</th>
                  <th className="py-2.5 px-3 font-normal">Type</th>
                  <th className="py-2.5 px-3 font-normal">Instrument</th>
                  <th className="py-2.5 px-3 font-normal">Product</th>
                  <th className="py-2.5 px-3 font-normal text-right">Qty.</th>
                  <th className="py-2.5 px-3 font-normal text-right">Price / Trig</th>
                  <th className="py-2.5 px-3 font-normal text-right">Status</th>
                  <th className="py-2.5 px-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {openOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E]">
                    <td className="py-2.5 px-3 tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      {formatTime(o.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${
                          o.side === 'BUY'
                            ? 'bg-[#4184F3]/12 text-[#4184F3]'
                            : 'bg-[#FF5722]/12 text-[#FF5722]'
                        }`}
                      >
                        {o.side}
                      </span>{' '}
                      <span className="text-xs text-[#666666] dark:text-[#A0A0A0]">
                        {o.orderType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#444444] dark:text-[#E0E0E0]">
                      {o.symbol}{' '}
                      <span className="text-[10px] text-[#9B9B9B]">{o.exchange}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#666666] dark:text-[#A0A0A0]">
                      {o.product}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {o.filledQuantity}/{o.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatPrice(o.price)}
                      {o.triggerPrice > 0 ? ` / ${formatPrice(o.triggerPrice)}` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs text-[#D97706] font-medium">
                      {o.status}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        disabled={cancellingId === o.id}
                        onClick={() => handleCancel(o.id)}
                        aria-label={`Cancel order ${o.id} for ${o.symbol}`}
                        className="inline-flex items-center gap-1 text-xs text-[#DF514C] hover:underline font-medium cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === o.id ? 'Cancelling...' : 'Cancel'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Executed / Completed Orders */}
      <section aria-labelledby="executed-orders-heading">
        <h2
          id="executed-orders-heading"
          className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0] mb-3 pb-2 border-b border-[#EEEEEE] dark:border-[#282828]"
        >
          Executed orders ({completedOrders.length})
        </h2>

        {completedOrders.length === 0 ? (
          <div className="py-8 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded text-xs text-[#9B9B9B]">
            No executed paper orders yet. Hover any symbol in the Marketwatch and click B or S to place a simulated trade.
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-[13px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                  <th className="py-2.5 px-3 font-normal">Time</th>
                  <th className="py-2.5 px-3 font-normal">Type</th>
                  <th className="py-2.5 px-3 font-normal">Instrument</th>
                  <th className="py-2.5 px-3 font-normal">Product</th>
                  <th className="py-2.5 px-3 font-normal text-right">Qty.</th>
                  <th className="py-2.5 px-3 font-normal text-right">Avg. price</th>
                  <th className="py-2.5 px-3 font-normal text-right">Order ID</th>
                  <th className="py-2.5 px-3 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {completedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E]">
                    <td className="py-2.5 px-3 tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      {formatTime(o.updatedAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 text-[11px] font-semibold rounded ${
                          o.side === 'BUY'
                            ? 'bg-[#4184F3]/12 text-[#4184F3]'
                            : 'bg-[#FF5722]/12 text-[#FF5722]'
                        }`}
                      >
                        {o.side}
                      </span>{' '}
                      <span className="text-xs text-[#666666] dark:text-[#A0A0A0]">
                        {o.orderType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#444444] dark:text-[#E0E0E0]">
                      {o.symbol}{' '}
                      <span className="text-[10px] text-[#9B9B9B]">{o.exchange}</span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-[#666666] dark:text-[#A0A0A0]">
                      {o.product}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {o.filledQuantity}/{o.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {o.averagePrice > 0 ? formatPrice(o.averagePrice) : formatPrice(o.price)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs text-[#9B9B9B]">
                      {o.id}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right text-xs font-medium ${
                        o.status === 'COMPLETE'
                          ? 'text-[#4CAF50] dark:text-[#4ADE80]'
                          : 'text-[#9B9B9B]'
                      }`}
                    >
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { calculateRequiredMargin } from '../../shared/portfolioMath.ts';
import type {
  Holding,
  Instrument,
  MarketQuote,
  OrderRequest,
  OrderSide,
  OrderType,
  ProductType,
} from '../../shared/types.ts';
import { formatINR, formatPrice, getChangeColorClass } from '../utils/format.ts';

interface OrderModalProps {
  instrument: Instrument;
  quote: MarketQuote;
  initialSide: OrderSide;
  availableCash: number;
  holdings: Holding[];
  onClose: () => void;
  onSubmitOrder: (request: OrderRequest) => Promise<{ ok: boolean; error?: string }>;
}

export function OrderModal({
  instrument,
  quote,
  initialSide,
  availableCash,
  holdings,
  onClose,
  onSubmitOrder,
}: OrderModalProps) {
  const isDerivative = instrument.exchange === 'NFO' || instrument.exchange === 'BFO';
  const [side, setSide] = useState<OrderSide>(initialSide);
  const [product, setProduct] = useState<ProductType>(
    isDerivative ? 'NRML' : 'CNC',
  );
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [quantityStr, setQuantityStr] = useState<string>(
    String(instrument.lotSize || 1),
  );
  const [price, setPrice] = useState<string>(quote.ltp.toFixed(2));
  const [triggerPrice, setTriggerPrice] = useState<string>(quote.ltp.toFixed(2));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Math.max(0, Math.floor(Number(quantityStr) || 0));

  useEffect(() => {
    if (orderType === 'MARKET' || orderType === 'SL-M') {
      setPrice(quote.ltp.toFixed(2));
    }
  }, [quote.ltp, orderType]);

  const effectivePrice =
    orderType === 'MARKET' || orderType === 'SL-M'
      ? quote.ltp
      : Number(price) || 0;

  const existingHolding = useMemo(
    () => holdings.find((h) => h.token === instrument.token),
    [holdings, instrument.token],
  );

  const holdingPreview = useMemo(() => {
    if (product !== 'CNC' || quantity <= 0 || effectivePrice <= 0) return null;

    if (side === 'BUY') {
      const prevQty = existingHolding?.quantity ?? 0;
      const prevInvested = existingHolding?.investedValue ?? 0;
      const afterQty = prevQty + quantity;
      const afterInvested = prevInvested + quantity * effectivePrice;
      const afterAvg = afterInvested / afterQty;
      const liveValue = afterQty * quote.ltp;
      const livePnl = liveValue - afterInvested;
      return {
        type: 'BUY' as const,
        afterQty,
        afterAvg,
        afterInvested,
        livePnl,
      };
    }

    const heldQty = existingHolding?.quantity ?? 0;
    const heldAvg = existingHolding?.averagePrice ?? 0;
    const heldInvested = existingHolding?.investedValue ?? 0;
    const unitCost = heldQty > 0 ? heldInvested / heldQty : heldAvg;
    const estRealized =
      heldQty > 0 ? (effectivePrice - unitCost) * Math.min(quantity, heldQty) : 0;
    return {
      type: 'SELL' as const,
      heldQty,
      remainingQty: Math.max(0, heldQty - quantity),
      estRealized,
    };
  }, [product, quantity, effectivePrice, side, existingHolding, quote.ltp]);

  const requiredMargin = useMemo(
    () =>
      calculateRequiredMargin(
        side,
        product,
        quantity,
        effectivePrice,
        holdings,
        instrument.token,
      ),
    [side, product, quantity, effectivePrice, holdings, instrument.token],
  );

  const isBuy = side === 'BUY';
  const accentBg = isBuy ? 'bg-[#4184F3]' : 'bg-[#FF5722]';
  const accentHover = isBuy ? 'hover:bg-[#3367D6]' : 'hover:bg-[#E64A19]';

  const isRestingLimit =
    orderType === 'LIMIT' &&
    effectivePrice > 0 &&
    ((isBuy && effectivePrice < quote.ltp) || (!isBuy && effectivePrice > quote.ltp));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (quantity <= 0) {
      setError('Quantity must be a positive whole number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await onSubmitOrder({
        token: instrument.token,
        side,
        product,
        orderType,
        quantity,
        price:
          orderType === 'LIMIT' || orderType === 'CUSTOM' || orderType === 'SL'
            ? Number(price)
            : undefined,
        triggerPrice:
          orderType === 'SL' || orderType === 'SL-M'
            ? Number(triggerPrice)
            : undefined,
      });
      if (!res.ok) {
        setError(res.error || 'Order rejected.');
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div className="w-full max-w-[480px] bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded shadow-2xl overflow-hidden">
        {/* Kite Signature Coloured Header */}
        <div className={`${accentBg} text-white px-5 py-3.5 flex items-center justify-between`}>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="order-modal-title" className="text-sm font-semibold">
                {side} {instrument.symbol}
              </h2>
              <span className="text-[11px] opacity-90 tabular-nums">
                {instrument.exchange} × {quantity} Qty
              </span>
            </div>
            <div className="text-xs opacity-90 tabular-nums mt-0.5">
              LTP ₹{formatPrice(quote.ltp)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white/15 rounded p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                  isBuy ? 'bg-white text-[#4184F3]' : 'text-white/90 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                  !isBuy ? 'bg-white text-[#FF5722]' : 'text-white/90 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close order window"
              className="p-1 rounded hover:bg-white/15 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="px-3 py-2 text-xs text-[#DF514C] dark:text-[#F87171] bg-[#DF514C]/10 border border-[#DF514C]/30 rounded"
            >
              {error}
            </div>
          )}

          {/* Product Type */}
          <div>
            <span className="block text-[11px] font-medium text-[#9B9B9B] uppercase mb-1.5">
              Product
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {(isDerivative
                ? (['NRML', 'MIS'] as ProductType[])
                : (['CNC', 'MIS'] as ProductType[])
              ).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProduct(p)}
                  className={`py-2 px-3 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    product === p
                      ? isBuy
                        ? 'border-[#4184F3] text-[#4184F3] bg-[#4184F3]/10'
                        : 'border-[#FF5722] text-[#FF5722] bg-[#FF5722]/10'
                      : 'border-[#E0E0E0] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0]'
                  }`}
                >
                  {p === 'CNC'
                    ? 'Longterm (CNC)'
                    : p === 'MIS'
                      ? 'Intraday (MIS 5x)'
                      : 'Overnight (NRML)'}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity, Price, Trigger Price */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="order-qty"
                className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
              >
                Qty {instrument.lotSize > 1 ? `(Lot ${instrument.lotSize})` : ''}
              </label>
              <input
                id="order-qty"
                type="number"
                min={instrument.lotSize || 1}
                step={instrument.lotSize || 1}
                required
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                onBlur={() => {
                  if (!quantityStr || Number(quantityStr) < 1) {
                    setQuantityStr(String(instrument.lotSize || 1));
                  }
                }}
                className="w-full px-2.5 py-2 text-sm tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
              />
            </div>

            <div>
              <label
                htmlFor="order-price"
                className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
              >
                Price
              </label>
              <input
                id="order-price"
                type="number"
                step="0.05"
                min="0.05"
                disabled={orderType === 'MARKET' || orderType === 'SL-M'}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-sm tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] disabled:opacity-50 disabled:bg-[#F5F5F5] dark:disabled:bg-[#141414]"
              />
            </div>

            <div>
              <label
                htmlFor="order-trigger"
                className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
              >
                Trigger Price
              </label>
              <input
                id="order-trigger"
                type="number"
                step="0.05"
                min="0.05"
                disabled={orderType === 'MARKET' || orderType === 'LIMIT' || orderType === 'CUSTOM'}
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                className="w-full px-2.5 py-2 text-sm tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] disabled:opacity-50 disabled:bg-[#F5F5F5] dark:disabled:bg-[#141414]"
              />
            </div>
          </div>

          {/* Order Type */}
          <div>
            <span className="block text-[11px] font-medium text-[#9B9B9B] uppercase mb-1.5">
              Order Type
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {(['MARKET', 'LIMIT', 'CUSTOM', 'SL', 'SL-M'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`py-1.5 px-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                    orderType === t
                      ? isBuy
                        ? 'border-[#4184F3] text-[#4184F3] bg-[#4184F3]/10'
                        : 'border-[#FF5722] text-[#FF5722] bg-[#FF5722]/10'
                      : 'border-[#E0E0E0] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {orderType === 'CUSTOM' && (
              <p className="text-[11px] text-[#666666] dark:text-[#A0A0A0] mt-1.5">
                Instant fill at your entered price — adds directly to {product === 'CNC' ? 'Holdings' : 'Positions'} and tracks live P&amp;L as LTP moves.
              </p>
            )}
            {isRestingLimit && (
              <p className="text-[11px] text-[#9B9B9B] mt-1.5">
                LIMIT waits until LTP hits ₹{formatPrice(effectivePrice)}.{' '}
                <button
                  type="button"
                  onClick={() => setOrderType('CUSTOM')}
                  className="text-[#4184F3] hover:underline font-medium cursor-pointer"
                >
                  Use CUSTOM to fill now
                </button>
              </p>
            )}
          </div>

          {/* CNC Holding Impact Preview */}
          {holdingPreview && (
            <div className="px-3 py-2 bg-[#F9F9F9] dark:bg-[#121212] border border-[#EEEEEE] dark:border-[#282828] rounded text-[11px] tabular-nums space-y-0.5">
              {holdingPreview.type === 'BUY' ? (
                <>
                  <div className="flex items-center justify-between text-[#666666] dark:text-[#A0A0A0]">
                    <span>
                      Holding after buy: <strong className="text-[#444444] dark:text-[#E0E0E0]">{holdingPreview.afterQty} qty</strong> @ ₹{formatPrice(holdingPreview.afterAvg)} avg
                    </span>
                    <span>Inv. {formatINR(holdingPreview.afterInvested)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#9B9B9B]">
                    <span>Live P&amp;L at current LTP ₹{formatPrice(quote.ltp)}</span>
                    <span className={`font-medium ${getChangeColorClass(holdingPreview.livePnl)}`}>
                      {formatINR(holdingPreview.livePnl, true)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-[#666666] dark:text-[#A0A0A0]">
                  <span>
                    Held CNC: <strong className="text-[#444444] dark:text-[#E0E0E0]">{holdingPreview.heldQty} qty</strong> → Remaining {holdingPreview.remainingQty} qty
                  </span>
                  {holdingPreview.heldQty > 0 && (
                    <span className={`font-medium ${getChangeColorClass(holdingPreview.estRealized)}`}>
                      Est. P&amp;L {formatINR(holdingPreview.estRealized, true)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Margin Strip & Submit */}
          <div className="pt-3 border-t border-[#EEEEEE] dark:border-[#282828] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs space-y-0.5 tabular-nums">
              <div className="flex items-center gap-2">
                <span className="text-[#9B9B9B]">Margin required:</span>
                <span className="font-semibold text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(requiredMargin)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#9B9B9B]">Available cash:</span>
                <span
                  className={
                    requiredMargin > availableCash
                      ? 'text-[#DF514C] font-semibold'
                      : 'text-[#4CAF50] dark:text-[#4ADE80]'
                  }
                >
                  {formatINR(availableCash)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className={`px-5 py-2 text-xs font-semibold text-white rounded transition-colors cursor-pointer ${accentBg} ${accentHover} disabled:opacity-60`}
              >
                {submitting ? 'Placing...' : isBuy ? 'Buy' : 'Sell'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium border border-[#E0E0E0] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0] hover:bg-[#F5F7FA] dark:hover:bg-[#212121] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

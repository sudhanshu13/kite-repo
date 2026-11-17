import { useEffect, useState } from 'react';
import type {
  Instrument,
  MarketQuote,
  OrderSide,
  TechnicalSummary,
} from '../../shared/types.ts';
import { apiFetch } from '../utils/api.ts';
import {
  formatPrice,
  formatSigned,
  getChangeColorClass,
  getSignalTextClass,
} from '../utils/format.ts';

interface TechnicalsViewProps {
  instrument?: Instrument;
  quote?: MarketQuote;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
}

export function TechnicalsView({
  instrument,
  quote,
  onOpenOrderModal,
}: TechnicalsViewProps) {
  const [summary, setSummary] = useState<TechnicalSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const token = instrument?.token;

  useEffect(() => {
    if (!token) return;
    let active = true;

    async function fetchTechnicals(isInitial: boolean) {
      if (isInitial) setLoading(true);
      try {
        const res = await apiFetch(`/api/technicals/${token}`);
        if (!res.ok) return;
        const data = (await res.json()) as { summary?: TechnicalSummary };
        if (active && data.summary) {
          setSummary(data.summary);
        }
      } finally {
        if (active && isInitial) setLoading(false);
      }
    }

    fetchTechnicals(true);
    const interval = setInterval(() => fetchTechnicals(false), 1600);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token]);

  if (!instrument || !quote) {
    return (
      <div className="p-8 text-sm text-[#9B9B9B]">
        Select a symbol from the Marketwatch to inspect live technical indicators and market depth.
      </div>
    );
  }

  const totalBidQty = quote.depth.buy.reduce((acc, b) => acc + b.quantity, 0);
  const totalAskQty = quote.depth.sell.reduce((acc, s) => acc + s.quantity, 0);
  const totalDepth = totalBidQty + totalAskQty || 1;
  const bidRatio = Math.round((totalBidQty / totalDepth) * 100);

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-6">
      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-xl font-normal text-[#444444] dark:text-[#E0E0E0]">
              {instrument.symbol}
            </h1>
            <span className="text-xs text-[#9B9B9B] uppercase">
              {instrument.exchange} · {instrument.sector}
            </span>
          </div>
          <p className="text-xs text-[#9B9B9B] mt-0.5">{instrument.name}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right tabular-nums">
            <div className={`text-xl font-medium ${getChangeColorClass(quote.change)}`}>
              ₹{formatPrice(quote.ltp)}
            </div>
            <div className={`text-xs ${getChangeColorClass(quote.change)}`}>
              {formatSigned(quote.change)} ({quote.changePercent >= 0 ? '+' : ''}
              {quote.changePercent.toFixed(2)}%)
            </div>
          </div>

          {!instrument.isIndex && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenOrderModal(instrument.token, 'BUY')}
                className="px-4 py-2 text-xs font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded transition-colors cursor-pointer"
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => onOpenOrderModal(instrument.token, 'SELL')}
                className="px-4 py-2 text-xs font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded transition-colors cursor-pointer"
              >
                Sell
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Quote Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 py-3 px-4 bg-[#F9F9F9] dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded text-xs tabular-nums">
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">OPEN</span>
          <span className="font-medium">{formatPrice(quote.open)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">HIGH</span>
          <span className="font-medium">{formatPrice(quote.high)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">LOW</span>
          <span className="font-medium">{formatPrice(quote.low)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">PREV. CLOSE</span>
          <span className="font-medium">{formatPrice(quote.close)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">VWAP</span>
          <span className="font-medium">{formatPrice(quote.averagePrice)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">VOLUME</span>
          <span className="font-medium">
            {quote.volume > 0 ? quote.volume.toLocaleString('en-IN') : '—'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">LOWER CKT</span>
          <span className="font-medium">{formatPrice(quote.lowerCircuit)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[#9B9B9B] block">UPPER CKT</span>
          <span className="font-medium">{formatPrice(quote.upperCircuit)}</span>
        </div>
      </div>

      {/* Technical Consensus + Market Depth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Consensus */}
        <section
          aria-labelledby="tech-consensus-heading"
          className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              id="tech-consensus-heading"
              className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]"
            >
              Technical Summary
            </h2>
            {summary && (
              <span
                className={`text-sm font-semibold ${getSignalTextClass(summary.overallSignal)}`}
              >
                {summary.overallSignal}
              </span>
            )}
          </div>

          {loading && !summary ? (
            <div className="py-6 text-xs text-[#9B9B9B]">Computing live indicators...</div>
          ) : summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center py-2.5 bg-[#F9F9F9] dark:bg-[#121212] rounded tabular-nums">
                <div>
                  <div className="text-lg font-medium text-[#4CAF50] dark:text-[#4ADE80]">
                    {summary.buyCount}
                  </div>
                  <div className="text-[11px] text-[#9B9B9B]">Buy</div>
                </div>
                <div>
                  <div className="text-lg font-medium text-[#666666] dark:text-[#A0A0A0]">
                    {summary.neutralCount}
                  </div>
                  <div className="text-[11px] text-[#9B9B9B]">Neutral</div>
                </div>
                <div>
                  <div className="text-lg font-medium text-[#DF514C] dark:text-[#F87171]">
                    {summary.sellCount}
                  </div>
                  <div className="text-[11px] text-[#9B9B9B]">Sell</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-2.5 rounded bg-[#F9F9F9] dark:bg-[#121212] space-y-1">
                  <div className="text-[11px] text-[#9B9B9B]">Oscillators</div>
                  <div className="tabular-nums font-medium text-[#444444] dark:text-[#E0E0E0]">
                    {summary.oscillators.filter((o) => o.signal === 'Buy').length} Buy ·{' '}
                    {summary.oscillators.filter((o) => o.signal === 'Neutral').length} Neut ·{' '}
                    {summary.oscillators.filter((o) => o.signal === 'Sell').length} Sell
                  </div>
                </div>
                <div className="p-2.5 rounded bg-[#F9F9F9] dark:bg-[#121212] space-y-1">
                  <div className="text-[11px] text-[#9B9B9B]">Moving Averages</div>
                  <div className="tabular-nums font-medium text-[#444444] dark:text-[#E0E0E0]">
                    {summary.movingAverages.filter((m) => m.signal === 'Buy').length} Buy ·{' '}
                    {summary.movingAverages.filter((m) => m.signal === 'Neutral').length} Neut ·{' '}
                    {summary.movingAverages.filter((m) => m.signal === 'Sell').length} Sell
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-[#EEEEEE] dark:border-[#282828]">
                <div className="text-[11px] text-[#9B9B9B] flex items-center justify-between tabular-nums">
                  <span>52W Low: ₹{formatPrice(quote.week52Low)}</span>
                  <span>52W High: ₹{formatPrice(quote.week52High)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#EEEEEE] dark:bg-[#282828] overflow-hidden">
                  <div
                    className="h-full bg-[#4184F3]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          4,
                          ((quote.ltp - quote.week52Low) /
                            Math.max(1, quote.week52High - quote.week52Low)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Level 2 Market Depth */}
        <section
          aria-labelledby="tech-depth-heading"
          className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              id="tech-depth-heading"
              className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]"
            >
              Market Depth (Level 2)
            </h2>
            {quote.depth.buy.length > 0 && (
              <span className="text-[11px] tabular-nums text-[#9B9B9B]">
                Bid {bidRatio}% · Ask {100 - bidRatio}%
              </span>
            )}
          </div>

          {quote.depth.buy.length === 0 ? (
            <div className="py-6 text-xs text-[#9B9B9B]">
              Market depth is available for equity and futures contracts.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-[#DF514C]/25">
                <div
                  className="bg-[#4184F3] h-full transition-all"
                  style={{ width: `${bidRatio}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-[11px] tabular-nums">
                <div>
                  <div className="grid grid-cols-3 text-[#9B9B9B] py-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                    <span>BID</span>
                    <span className="text-right">ORDERS</span>
                    <span className="text-right">QTY</span>
                  </div>
                  {quote.depth.buy.map((lvl, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-3 py-1 text-[#4184F3]"
                    >
                      <span>{formatPrice(lvl.price)}</span>
                      <span className="text-right">{lvl.orders}</span>
                      <span className="text-right">{lvl.quantity}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 pt-1 border-t border-[#EEEEEE] dark:border-[#282828] font-medium text-[#444444] dark:text-[#E0E0E0]">
                    <span>Total</span>
                    <span />
                    <span className="text-right">{totalBidQty}</span>
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-3 text-[#9B9B9B] py-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                    <span>OFFER</span>
                    <span className="text-right">ORDERS</span>
                    <span className="text-right">QTY</span>
                  </div>
                  {quote.depth.sell.map((lvl, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-3 py-1 text-[#DF514C] dark:text-[#F87171]"
                    >
                      <span>{formatPrice(lvl.price)}</span>
                      <span className="text-right">{lvl.orders}</span>
                      <span className="text-right">{lvl.quantity}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 pt-1 border-t border-[#EEEEEE] dark:border-[#282828] font-medium text-[#444444] dark:text-[#E0E0E0]">
                    <span>Total</span>
                    <span />
                    <span className="text-right">{totalAskQty}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Oscillators & Moving Averages Tables */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F9F9F9] dark:bg-[#121212] border-b border-[#EEEEEE] dark:border-[#282828] flex items-center justify-between">
              <h2 className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0]">
                Oscillators
              </h2>
              <span className="text-[11px] text-[#9B9B9B]">Live Tick Series</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2 px-4 text-left font-normal">Indicator</th>
                  <th className="py-2 px-4 text-right font-normal">Value</th>
                  <th className="py-2 px-4 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {summary.oscillators.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2 px-4 text-[#444444] dark:text-[#E0E0E0]">
                      {row.name}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      {row.value}
                    </td>
                    <td
                      className={`py-2 px-4 text-right font-medium ${getSignalTextClass(row.signal)}`}
                    >
                      {row.signal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F9F9F9] dark:bg-[#121212] border-b border-[#EEEEEE] dark:border-[#282828] flex items-center justify-between">
              <h2 className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0]">
                Moving Averages
              </h2>
              <span className="text-[11px] text-[#9B9B9B]">SMA &amp; EMA</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2 px-4 text-left font-normal">Period</th>
                  <th className="py-2 px-4 text-right font-normal">Value</th>
                  <th className="py-2 px-4 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {summary.movingAverages.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2 px-4 text-[#444444] dark:text-[#E0E0E0]">
                      {row.name}
                    </td>
                    <td className="py-2 px-4 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      {formatPrice(row.numericValue)}
                    </td>
                    <td
                      className={`py-2 px-4 text-right font-medium ${getSignalTextClass(row.signal)}`}
                    >
                      {row.signal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* Pivot Points Matrix */}
      {summary && (
        <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F9F9F9] dark:bg-[#121212] border-b border-[#EEEEEE] dark:border-[#282828]">
            <h2 className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0]">
              Pivot Points
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2 px-3 text-left font-normal">Method</th>
                  <th className="py-2 px-3 text-right font-normal">S3</th>
                  <th className="py-2 px-3 text-right font-normal">S2</th>
                  <th className="py-2 px-3 text-right font-normal">S1</th>
                  <th className="py-2 px-3 text-right font-normal">Pivot</th>
                  <th className="py-2 px-3 text-right font-normal">R1</th>
                  <th className="py-2 px-3 text-right font-normal">R2</th>
                  <th className="py-2 px-3 text-right font-normal">R3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {summary.pivots.map((p) => (
                  <tr key={p.method}>
                    <td className="py-2 px-3 font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {p.method}
                    </td>
                    <td className="py-2 px-3 text-right text-[#DF514C] dark:text-[#F87171]">
                      {formatPrice(p.s3)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#DF514C] dark:text-[#F87171]">
                      {formatPrice(p.s2)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#DF514C] dark:text-[#F87171]">
                      {formatPrice(p.s1)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(p.pivot)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#4CAF50] dark:text-[#4ADE80]">
                      {formatPrice(p.r1)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#4CAF50] dark:text-[#4ADE80]">
                      {formatPrice(p.r2)}
                    </td>
                    <td className="py-2 px-3 text-right text-[#4CAF50] dark:text-[#4ADE80]">
                      {formatPrice(p.r3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

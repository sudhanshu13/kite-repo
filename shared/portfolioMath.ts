import type {
  Holding,
  Instrument,
  MarketQuote,
  Order,
  OrderRequest,
  OrderSide,
  PortfolioState,
  Position,
  ProductType,
} from './types.ts';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getMarginMultiplier(product: ProductType): number {
  if (product === 'MIS') return 0.2; // 5x intraday leverage
  if (product === 'NRML') return 0.5;
  return 1.0; // CNC 100% delivery margin
}

export function calculateRequiredMargin(
  side: OrderSide,
  product: ProductType,
  quantity: number,
  price: number,
  existingHoldings: Holding[],
  token: number,
): number {
  if (quantity <= 0 || price <= 0) return 0;
  if (side === 'SELL' && product === 'CNC') {
    const held = existingHoldings.find((h) => h.token === token);
    if (held && held.quantity >= quantity) {
      return 0; // Selling existing CNC delivery shares requires zero additional cash margin
    }
  }
  return round2(quantity * price * getMarginMultiplier(product));
}

export function computeHoldingMetrics(holding: Holding, quote?: MarketQuote) {
  const ltp = round2(quote ? quote.ltp : holding.averagePrice);
  const prevClose = round2(quote ? quote.close : holding.averagePrice);
  const investedValue = round2(holding.investedValue);
  const currentValue = round2(holding.quantity * ltp);
  const prevValue = round2(holding.quantity * prevClose);
  const pnl = round2(currentValue - investedValue);
  const pnlPercent =
    investedValue > 0 ? round2((pnl / investedValue) * 100) : 0;
  const dayPnl = round2(currentValue - prevValue);
  const dayChangePercent =
    prevClose > 0 ? round2(((ltp - prevClose) / prevClose) * 100) : 0;

  return {
    ltp,
    prevClose,
    prevValue,
    currentValue,
    pnl,
    pnlPercent,
    dayPnl,
    dayChangePercent,
  };
}

export function computeHoldingsTotals(
  rows: ReadonlyArray<{
    investedValue: number;
    currentValue: number;
    dayPnl: number;
    prevValue?: number;
  }>,
) {
  let investment = 0;
  let current = 0;
  let dayPnl = 0;
  let prevTotal = 0;
  for (const r of rows) {
    investment += r.investedValue;
    current += r.currentValue;
    dayPnl += r.dayPnl;
    prevTotal += r.prevValue !== undefined ? r.prevValue : r.currentValue - r.dayPnl;
  }
  investment = round2(investment);
  current = round2(current);
  dayPnl = round2(dayPnl);
  prevTotal = round2(prevTotal);

  const totalPnl = round2(current - investment);
  const totalPnlPct = investment > 0 ? round2((totalPnl / investment) * 100) : 0;
  const dayPnlPct = prevTotal > 0 ? round2((dayPnl / prevTotal) * 100) : 0;

  return {
    investment,
    current,
    totalPnl,
    totalPnlPct,
    dayPnl,
    dayPnlPct,
  };
}

export function computePositionMetrics(position: Position, quote?: MarketQuote) {
  const ltp = quote
    ? quote.ltp
    : position.quantity >= 0
      ? position.averageBuyPrice || position.averageSellPrice
      : position.averageSellPrice || position.averageBuyPrice;

  let mtmPnl = position.realizedPnl;
  if (position.quantity > 0) {
    mtmPnl += (ltp - position.averageBuyPrice) * position.quantity;
  } else if (position.quantity < 0) {
    mtmPnl += (position.averageSellPrice - ltp) * Math.abs(position.quantity);
  }

  return {
    ltp,
    mtmPnl: round2(mtmPnl),
    isOpen: position.quantity !== 0,
  };
}

export function applyFilledOrderToPortfolio(params: {
  portfolio: PortfolioState;
  order: Order;
  fillPrice: number;
  nowIso: string;
}): PortfolioState {
  const { portfolio, order, fillPrice, nowIso } = params;
  const next: PortfolioState = structuredClone(portfolio);
  const qty = order.quantity;
  const value = round2(qty * fillPrice);
  const multiplier = getMarginMultiplier(order.product);
  const marginImpact = round2(value * multiplier);

  // Update order record
  const existingIdx = next.orders.findIndex((o) => o.id === order.id);
  if (existingIdx >= 0 && order.reservedMargin && order.reservedMargin > 0) {
    next.availableCash = round2(next.availableCash + order.reservedMargin);
    next.usedMargin = Math.max(0, round2(next.usedMargin - order.reservedMargin));
  }

  const filledOrder: Order = {
    ...order,
    filledQuantity: qty,
    averagePrice: fillPrice,
    reservedMargin: 0,
    status: 'COMPLETE',
    statusMessage: 'Executed in paper trading engine',
    updatedAt: nowIso,
  };
  if (existingIdx >= 0) {
    next.orders[existingIdx] = filledOrder;
  } else {
    next.orders.unshift(filledOrder);
  }

  // Handle CNC holdings
  if (order.product === 'CNC') {
    const hIdx = next.holdings.findIndex((h) => h.token === order.token);
    if (order.side === 'BUY') {
      if (hIdx >= 0) {
        const prev = next.holdings[hIdx];
        const totalQty = prev.quantity + qty;
        const totalInvested = round2(prev.investedValue + value);
        next.holdings[hIdx] = {
          ...prev,
          quantity: totalQty,
          investedValue: totalInvested,
          averagePrice: round2(totalInvested / totalQty),
          t1Quantity: prev.t1Quantity + qty,
        };
      } else {
        next.holdings.push({
          token: order.token,
          symbol: order.symbol,
          exchange: order.exchange,
          quantity: qty,
          averagePrice: fillPrice,
          investedValue: value,
          t1Quantity: qty,
        });
      }
      next.availableCash = round2(next.availableCash - value);
      next.usedMargin = round2(next.usedMargin + value);
    } else {
      // SELL CNC
      if (hIdx >= 0) {
        const prev = next.holdings[hIdx];
        const unitCost = prev.quantity > 0 ? prev.investedValue / prev.quantity : prev.averagePrice;
        const soldCost =
          qty >= prev.quantity ? prev.investedValue : round2(unitCost * qty);
        const realized = round2(value - soldCost);
        next.realizedPnl = round2(next.realizedPnl + realized);
        next.availableCash = round2(next.availableCash + value);
        next.usedMargin = Math.max(0, round2(next.usedMargin - soldCost));

        const remainingQty = prev.quantity - qty;
        if (remainingQty <= 0) {
          next.holdings.splice(hIdx, 1);
        } else {
          const remainingInvested = Math.max(0, round2(prev.investedValue - soldCost));
          next.holdings[hIdx] = {
            ...prev,
            quantity: remainingQty,
            investedValue: remainingInvested,
            averagePrice: round2(remainingInvested / remainingQty),
            t1Quantity: Math.max(0, prev.t1Quantity - qty),
          };
        }
      }
    }
  } else {
    // MIS / NRML Intraday & Carryforward Positions
    const posId = `${order.token}-${order.product}`;
    let pIdx = next.positions.findIndex((p) => p.id === posId);
    if (pIdx < 0) {
      next.positions.push({
        id: posId,
        token: order.token,
        symbol: order.symbol,
        exchange: order.exchange,
        product: order.product,
        quantity: 0,
        buyQuantity: 0,
        sellQuantity: 0,
        buyValue: 0,
        sellValue: 0,
        averageBuyPrice: 0,
        averageSellPrice: 0,
        realizedPnl: 0,
      });
      pIdx = next.positions.length - 1;
    }

    const pos = next.positions[pIdx];
    const prevQty = pos.quantity;

    if (order.side === 'BUY') {
      pos.buyQuantity += qty;
      pos.buyValue = round2(pos.buyValue + value);
      pos.averageBuyPrice = round2(pos.buyValue / pos.buyQuantity);

      if (prevQty < 0) {
        const coveredQty = Math.min(qty, Math.abs(prevQty));
        const pnl = round2((pos.averageSellPrice - fillPrice) * coveredQty);
        pos.realizedPnl = round2(pos.realizedPnl + pnl);
        next.realizedPnl = round2(next.realizedPnl + pnl);
        const releasedMargin = round2(coveredQty * pos.averageSellPrice * multiplier);
        next.availableCash = round2(next.availableCash + releasedMargin + pnl);
        next.usedMargin = Math.max(0, round2(next.usedMargin - releasedMargin));

        const extraLongQty = qty - coveredQty;
        if (extraLongQty > 0) {
          const extraMargin = round2(extraLongQty * fillPrice * multiplier);
          next.availableCash = round2(next.availableCash - extraMargin);
          next.usedMargin = round2(next.usedMargin + extraMargin);
        }
      } else {
        next.availableCash = round2(next.availableCash - marginImpact);
        next.usedMargin = round2(next.usedMargin + marginImpact);
      }

      pos.quantity += qty;
    } else {
      pos.sellQuantity += qty;
      pos.sellValue = round2(pos.sellValue + value);
      pos.averageSellPrice = round2(pos.sellValue / pos.sellQuantity);

      if (prevQty > 0) {
        const closedQty = Math.min(qty, prevQty);
        const pnl = round2((fillPrice - pos.averageBuyPrice) * closedQty);
        pos.realizedPnl = round2(pos.realizedPnl + pnl);
        next.realizedPnl = round2(next.realizedPnl + pnl);
        const releasedMargin = round2(closedQty * pos.averageBuyPrice * multiplier);
        next.availableCash = round2(next.availableCash + releasedMargin + pnl);
        next.usedMargin = Math.max(0, round2(next.usedMargin - releasedMargin));

        const extraShortQty = qty - closedQty;
        if (extraShortQty > 0) {
          const extraMargin = round2(extraShortQty * fillPrice * multiplier);
          next.availableCash = round2(next.availableCash - extraMargin);
          next.usedMargin = round2(next.usedMargin + extraMargin);
        }
      } else {
        next.availableCash = round2(next.availableCash - marginImpact);
        next.usedMargin = round2(next.usedMargin + marginImpact);
      }

      pos.quantity -= qty;
    }
  }

  return next;
}

export function validateOrderRequest(params: {
  portfolio: PortfolioState;
  request: OrderRequest;
  instrument: Instrument;
  quote: MarketQuote;
}): { ok: true; effectivePrice: number; requiredMargin: number } | { ok: false; error: string } {
  const { portfolio, request, instrument, quote } = params;

  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive whole number.' };
  }
  if (instrument.lotSize > 1 && request.quantity % instrument.lotSize !== 0) {
    return {
      ok: false,
      error: `Quantity for ${instrument.symbol} must be a multiple of lot size ${instrument.lotSize}.`,
    };
  }
  if (instrument.isIndex) {
    return {
      ok: false,
      error: 'Spot indices cannot be traded directly. Select an equity or futures contract.',
    };
  }

  const effectivePrice =
    request.orderType === 'MARKET' || request.orderType === 'SL-M'
      ? quote.ltp
      : Number(request.price || 0);

  if (effectivePrice <= 0) {
    return { ok: false, error: 'Order price must be greater than zero.' };
  }

  if (
    (request.orderType === 'SL' || request.orderType === 'SL-M') &&
    (!request.triggerPrice || request.triggerPrice <= 0)
  ) {
    return { ok: false, error: 'Stop-loss orders require a valid trigger price.' };
  }

  if (request.side === 'SELL' && request.product === 'CNC') {
    const held = portfolio.holdings.find((h) => h.token === instrument.token);
    if (!held || held.quantity < request.quantity) {
      return {
        ok: false,
        error: `Insufficient CNC holdings for ${instrument.symbol}. Available: ${held?.quantity ?? 0} qty. Use MIS for intraday shorting.`,
      };
    }
  }

  const requiredMargin = calculateRequiredMargin(
    request.side,
    request.product,
    request.quantity,
    effectivePrice,
    portfolio.holdings,
    instrument.token,
  );

  if (requiredMargin > portfolio.availableCash) {
    return {
      ok: false,
      error: `Insufficient margin. Required ₹${requiredMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}, Available ₹${portfolio.availableCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
    };
  }

  return { ok: true, effectivePrice, requiredMargin };
}

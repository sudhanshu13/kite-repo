export type Exchange = 'NSE' | 'BSE' | 'NFO' | 'INDICES';

export interface Instrument {
  token: number;
  symbol: string;
  name: string;
  exchange: Exchange;
  lotSize: number;
  tickSize: number;
  basePrice: number;
  sector: string;
  isIndex?: boolean;
  yahooSymbol?: string;
  derivedFromToken?: number;
  futuresBasisBps?: number;
}

export interface MarketDepthLevel {
  price: number;
  orders: number;
  quantity: number;
}

export interface MarketQuote {
  token: number;
  symbol: string;
  exchange: Exchange;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  averagePrice: number;
  lastQty: number;
  lowerCircuit: number;
  upperCircuit: number;
  week52High: number;
  week52Low: number;
  timestamp: number;
  direction: 'up' | 'down' | 'flat';
  depth: {
    buy: MarketDepthLevel[];
    sell: MarketDepthLevel[];
  };
}

export type IndicatorSignal = 'Buy' | 'Neutral' | 'Sell';

export type OverallTechnicalRating =
  | 'Strong Buy'
  | 'Buy'
  | 'Neutral'
  | 'Sell'
  | 'Strong Sell';

export interface TechnicalIndicatorRow {
  name: string;
  value: string;
  numericValue: number;
  signal: IndicatorSignal;
}

export interface PivotLevelRow {
  method: 'Classic' | 'Fibonacci' | 'Camarilla';
  s3: number;
  s2: number;
  s1: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
}

export interface TechnicalSummary {
  token: number;
  symbol: string;
  exchange: Exchange;
  ltp: number;
  timestamp: number;
  overallSignal: OverallTechnicalRating;
  buyCount: number;
  neutralCount: number;
  sellCount: number;
  oscillators: TechnicalIndicatorRow[];
  movingAverages: TechnicalIndicatorRow[];
  pivots: PivotLevelRow[];
}

export type OrderSide = 'BUY' | 'SELL';
export type ProductType = 'CNC' | 'MIS' | 'NRML';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type OrderStatus =
  | 'OPEN'
  | 'TRIGGER PENDING'
  | 'COMPLETE'
  | 'CANCELLED'
  | 'REJECTED';

export interface Order {
  id: string;
  exchangeOrderId: string;
  userId: string;
  token: number;
  symbol: string;
  exchange: Exchange;
  side: OrderSide;
  product: ProductType;
  orderType: OrderType;
  quantity: number;
  filledQuantity: number;
  price: number;
  triggerPrice: number;
  averagePrice: number;
  status: OrderStatus;
  statusMessage?: string;
  reservedMargin?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRequest {
  token: number;
  side: OrderSide;
  product: ProductType;
  orderType: OrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
}

export interface Holding {
  token: number;
  symbol: string;
  exchange: Exchange;
  quantity: number;
  averagePrice: number;
  investedValue: number;
  t1Quantity: number;
}

export interface Position {
  id: string;
  token: number;
  symbol: string;
  exchange: Exchange;
  product: ProductType;
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  buyValue: number;
  sellValue: number;
  averageBuyPrice: number;
  averageSellPrice: number;
  realizedPnl: number;
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  summary: string;
}

export interface KiteApiConfig {
  connected: boolean;
  mode: 'SIMULATED_FEED' | 'LIVE_MARKET_FEED' | 'KITE_PROXY_READONLY';
  apiKeyMasked: string;
  lastSyncedAt?: string;
}

export interface PortfolioState {
  userId: string;
  userName: string;
  email: string;
  availableCash: number;
  openingBalance: number;
  usedMargin: number;
  realizedPnl: number;
  watchlists: Record<string, number[]>;
  orders: Order[];
  holdings: Holding[];
  positions: Position[];
  kiteApiConfig: KiteApiConfig;
  apiLogs: ApiLogEntry[];
}

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
}

export interface AdminUserSummary {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  availableCash: number;
  usedMargin: number;
  openingBalance: number;
  realizedPnl: number;
  holdingsCount: number;
  openPositionsCount: number;
  ordersCount: number;
  createdAt: string;
}

export interface AdminCreateUserRequest {
  userId: string;
  userName: string;
  email?: string;
  password: string;
  pin: string;
  role: UserRole;
  openingBalance?: number;
  seedSampleData?: boolean;
}

export interface AdminUpdateUserRequest {
  userName?: string;
  email?: string;
  role?: UserRole;
  disabled?: boolean;
  password?: string;
  pin?: string;
}

export type WatchlistSignalsMap = Record<number, OverallTechnicalRating>;

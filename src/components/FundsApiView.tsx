import { useState, type FormEvent } from 'react';
import { KeyRound, RefreshCw, ShieldAlert, Wifi } from 'lucide-react';
import type { PortfolioState } from '../../shared/types.ts';
import { formatINR, formatTime, getChangeColorClass } from '../utils/format.ts';

interface FundsApiViewProps {
  portfolio: PortfolioState;
  wsConnected: boolean;
  isAdmin: boolean;
  onAddFunds: (amount: number) => Promise<{ ok: boolean; error?: string }>;
  onResetPortfolio: () => Promise<void>;
  onConfigureKiteBridge: (
    apiKey: string,
    accessToken: string,
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
}

export function FundsApiView({
  portfolio,
  wsConnected,
  isAdmin,
  onAddFunds,
  onResetPortfolio,
  onConfigureKiteBridge,
}: FundsApiViewProps) {
  const [addAmount, setAddAmount] = useState('100000');
  const [fundsStatus, setFundsStatus] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [bridgeMsg, setBridgeMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAddFunds(e: FormEvent) {
    e.preventDefault();
    setFundsStatus(null);
    const num = Number(addAmount);
    const res = await onAddFunds(num);
    if (res.ok) {
      setFundsStatus(`Added ${formatINR(num)} to simulated margin.`);
    } else {
      setFundsStatus(res.error || 'Unable to add funds.');
    }
  }

  async function handleConnectBridge(e: FormEvent) {
    e.preventDefault();
    setBridgeMsg(null);
    setBusy(true);
    try {
      const res = await onConfigureKiteBridge(apiKey, accessToken);
      if (res.ok) {
        setBridgeMsg({
          type: 'ok',
          text: res.message || 'External read-only quote bridge configured.',
        });
        setApiKey('');
        setAccessToken('');
      } else {
        setBridgeMsg({
          type: 'err',
          text: res.error || 'Failed to verify external API credentials.',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnectBridge() {
    setBusy(true);
    try {
      const res = await onConfigureKiteBridge('', '');
      setBridgeMsg({
        type: 'ok',
        text: res.message || 'Disconnected external bridge; using built-in WebSocket feed.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            {isAdmin ? 'Funds & Real-Time API Configuration' : 'Funds'}
          </h1>
          <p className="text-xs text-[#9B9B9B] mt-0.5">
            {isAdmin
              ? 'Simulated paper trading margin and read-only market quote stream settings'
              : 'Instant, zero-cost paper margin summary for Equity and Commodity segments'}
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onResetPortfolio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#E0E0E0] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0] hover:border-[#DF514C] hover:text-[#DF514C] rounded transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Paper Portfolio</span>
          </button>
        )}
      </div>

      {/* 2-Column Layout: Virtual Margin Ledger + API Bridge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Virtual Equity Margin */}
        <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
              Virtual Equity Margin
            </h2>
            <span className="text-xs text-[#9B9B9B]">Paper Capital</span>
          </div>

          <div className="divide-y divide-[#EEEEEE] dark:divide-[#282828] text-xs">
            <div className="py-2.5 flex justify-between">
              <span className="text-[#9B9B9B]">Available margin</span>
              <span className="tabular-nums font-semibold text-sm text-[#444444] dark:text-[#E0E0E0]">
                {formatINR(portfolio.availableCash)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#9B9B9B]">Used margin</span>
              <span className="tabular-nums font-medium">
                {formatINR(portfolio.usedMargin)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#9B9B9B]">Opening balance</span>
              <span className="tabular-nums font-medium">
                {formatINR(portfolio.openingBalance)}
              </span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-[#9B9B9B]">Realised P&amp;L</span>
              <span
                className={`tabular-nums font-medium ${getChangeColorClass(portfolio.realizedPnl)}`}
              >
                {formatINR(portfolio.realizedPnl, true)}
              </span>
            </div>
          </div>

          {isAdmin ? (
            <form onSubmit={handleAddFunds} className="pt-2 space-y-2.5">
              <label
                htmlFor="add-virtual-funds"
                className="block text-xs font-medium text-[#666666] dark:text-[#A0A0A0]"
              >
                Add virtual capital (₹)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="add-virtual-funds"
                  type="number"
                  min="1"
                  max="10000000"
                  required
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded transition-colors cursor-pointer"
                >
                  Add funds
                </button>
              </div>
              {fundsStatus && (
                <p className="text-xs text-[#4CAF50] dark:text-[#4ADE80]">{fundsStatus}</p>
              )}
            </form>
          ) : (
            <div className="divide-y divide-[#EEEEEE] dark:divide-[#282828] text-xs pt-1 border-t border-[#EEEEEE] dark:border-[#282828]">
              <div className="py-2 flex justify-between">
                <span className="text-[#9B9B9B]">SPAN</span>
                <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">₹0.00</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-[#9B9B9B]">Delivery margin</span>
                <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">₹0.00</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-[#9B9B9B]">Exposure</span>
                <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">₹0.00</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-[#9B9B9B]">Collateral (Equity)</span>
                <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">₹0.00</span>
              </div>
            </div>
          )}
        </section>

        {!isAdmin ? (
          <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Commodity
              </h2>
              <span className="text-xs text-[#9B9B9B]">MCX Paper Segment</span>
            </div>

            <div className="divide-y divide-[#EEEEEE] dark:divide-[#282828] text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Available margin</span>
                <span className="tabular-nums font-semibold text-sm text-[#444444] dark:text-[#E0E0E0]">
                  ₹0.00
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Used margin</span>
                <span className="tabular-nums font-medium">₹0.00</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Available cash</span>
                <span className="tabular-nums font-medium">₹0.00</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Opening balance</span>
                <span className="tabular-nums font-medium">₹0.00</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Payin</span>
                <span className="tabular-nums font-medium">₹0.00</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-[#9B9B9B]">Total collateral</span>
                <span className="tabular-nums font-medium">₹0.00</span>
              </div>
            </div>

            <p className="text-[11px] text-[#9B9B9B] leading-relaxed">
              Virtual margin deposits and portfolio resets are managed by your workspace administrator.
            </p>
          </section>
        ) : (
          <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#4184F3]" />
              <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Market Data Stream &amp; API Bridge
              </h2>
            </div>
            <span
              className={`text-xs font-medium ${
                wsConnected
                  ? 'text-[#4CAF50] dark:text-[#4ADE80]'
                  : 'text-[#DF514C] dark:text-[#F87171]'
              }`}
            >
              {wsConnected ? 'Live Stream Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="p-3 bg-[#F9F9F9] dark:bg-[#121212] border border-[#EEEEEE] dark:border-[#282828] rounded text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-[#444444] dark:text-[#E0E0E0]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FF5722] shrink-0" />
              <span>Paper Trading Guard Active</span>
            </div>
            <p className="text-[#666666] dark:text-[#A0A0A0] leading-relaxed">
              Active feed: <strong className="font-medium">{portfolio.kiteApiConfig.mode}</strong>.
              External broker API credentials (optional) are used strictly server-side for
              read-only live LTP quotes—no real-money orders are ever transmitted.
            </p>
          </div>

          {portfolio.kiteApiConfig.connected ? (
            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-[#EEEEEE] dark:border-[#282828]">
                <span className="text-[#9B9B9B]">API Key</span>
                <span className="tabular-nums font-medium">
                  {portfolio.kiteApiConfig.apiKeyMasked}
                </span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleDisconnectBridge}
                className="px-4 py-2 text-xs font-medium border border-[#DF514C] text-[#DF514C] hover:bg-[#DF514C]/10 rounded cursor-pointer"
              >
                Disconnect Quote Bridge
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnectBridge} className="space-y-3">
              <div>
                <label
                  htmlFor="broker-api-key"
                  className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Broker API Key (Optional · Read-Only Quotes)
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="broker-api-key"
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter broker api_key"
                    className="w-full pl-8 pr-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="broker-access-token"
                  className="block text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Access Token
                </label>
                <input
                  id="broker-access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter broker access_token"
                  className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !apiKey.trim() || !accessToken.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#4184F3] hover:bg-[#3367D6] disabled:opacity-50 text-white rounded transition-colors cursor-pointer"
              >
                {busy ? 'Verifying...' : 'Verify & Connect Read-Only Feed'}
              </button>
            </form>
          )}

          {bridgeMsg && (
            <p
              className={`text-xs ${
                bridgeMsg.type === 'ok'
                  ? 'text-[#4CAF50] dark:text-[#4ADE80]'
                  : 'text-[#DF514C] dark:text-[#F87171]'
              }`}
            >
              {bridgeMsg.text}
            </p>
          )}
        </section>
        )}
      </div>

      {/* Real API Execution Audit Log (Admin only) */}
      {isAdmin && (
      <section className="border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F9F9F9] dark:bg-[#121212] border-b border-[#EEEEEE] dark:border-[#282828] flex items-center justify-between">
          <h2 className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0]">
            Session API &amp; Order Execution Log
          </h2>
          <span className="text-[11px] text-[#9B9B9B]">
            {portfolio.apiLogs.length} events
          </span>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                <th className="py-2 px-4 font-normal">Time</th>
                <th className="py-2 px-4 font-normal">Method</th>
                <th className="py-2 px-4 font-normal">Endpoint</th>
                <th className="py-2 px-4 font-normal">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {portfolio.apiLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-4 tabular-nums text-[#9B9B9B] whitespace-nowrap">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="py-2 px-4 tabular-nums font-medium text-[#4184F3] whitespace-nowrap">
                    {log.method} {log.status}
                  </td>
                  <td className="py-2 px-4 tabular-nums text-[#666666] dark:text-[#A0A0A0] whitespace-nowrap">
                    {log.endpoint}
                  </td>
                  <td className="py-2 px-4 text-[#444444] dark:text-[#E0E0E0]">
                    {log.summary}
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

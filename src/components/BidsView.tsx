import { useState } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import { formatINR } from '../utils/format.ts';

type BidsSubTab = 'ipo' | 'gsec' | 'auctions' | 'corporate';

interface IpoItem {
  id: string;
  symbol: string;
  company: string;
  category: 'Mainboard' | 'SME';
  dateRange: string;
  priceRange: string;
  cutoffPrice: number;
  lotSize: number;
  minAmount: number;
  status: 'Ongoing' | 'Upcoming';
}

interface GsecItem {
  id: string;
  symbol: string;
  name: string;
  type: 'T-Bill' | 'G-Sec' | 'SDL';
  indicativeYield: string;
  endDate: string;
  minInvestment: number;
}

interface CorporateActionItem {
  id: string;
  symbol: string;
  name: string;
  type: 'Buyback' | 'OFS' | 'Takeover';
  window: string;
  offerPrice: string;
  status: 'Open' | 'Upcoming';
}

interface AppliedBid {
  id: string;
  symbol: string;
  lots: number;
  price: number;
  amount: number;
  upiId: string;
  submittedAt: string;
}

const IPO_LIST: IpoItem[] = [
  {
    id: 'ipo-1',
    symbol: 'NTPCGREEN',
    company: 'NTPC Green Energy Ltd.',
    category: 'Mainboard',
    dateRange: '19 Nov – 22 Nov',
    priceRange: '₹102 – ₹108',
    cutoffPrice: 108,
    lotSize: 138,
    minAmount: 14904,
    status: 'Ongoing',
  },
  {
    id: 'ipo-2',
    symbol: 'ENVIROINFRA',
    company: 'Enviro Infra Engineers Ltd.',
    category: 'Mainboard',
    dateRange: '22 Nov – 26 Nov',
    priceRange: '₹140 – ₹148',
    cutoffPrice: 148,
    lotSize: 101,
    minAmount: 14948,
    status: 'Ongoing',
  },
  {
    id: 'ipo-3',
    symbol: 'ZINKA',
    company: 'Zinka Logistics Solutions Ltd.',
    category: 'Mainboard',
    dateRange: '25 Nov – 28 Nov',
    priceRange: '₹259 – ₹273',
    cutoffPrice: 273,
    lotSize: 54,
    minAmount: 14742,
    status: 'Upcoming',
  },
  {
    id: 'ipo-4',
    symbol: 'C2CSYS',
    company: 'C2C Advanced Systems Ltd.',
    category: 'SME',
    dateRange: '22 Nov – 26 Nov',
    priceRange: '₹214 – ₹226',
    cutoffPrice: 226,
    lotSize: 600,
    minAmount: 135600,
    status: 'Ongoing',
  },
];

const GSEC_LIST: GsecItem[] = [
  {
    id: 'gsec-1',
    symbol: '91D-TBILL',
    name: '91 Days Treasury Bill (GOI)',
    type: 'T-Bill',
    indicativeYield: '6.48%',
    endDate: '26 Nov 2026',
    minInvestment: 10000,
  },
  {
    id: 'gsec-2',
    symbol: '182D-TBILL',
    name: '182 Days Treasury Bill (GOI)',
    type: 'T-Bill',
    indicativeYield: '6.64%',
    endDate: '26 Nov 2026',
    minInvestment: 10000,
  },
  {
    id: 'gsec-3',
    symbol: '718GS2033',
    name: '7.18% GOI Bond 2033',
    type: 'G-Sec',
    indicativeYield: '6.82%',
    endDate: '28 Nov 2026',
    minInvestment: 10000,
  },
  {
    id: 'gsec-4',
    symbol: 'MH-SDL2034',
    name: 'Maharashtra State Development Loan 2034',
    type: 'SDL',
    indicativeYield: '7.14%',
    endDate: '28 Nov 2026',
    minInvestment: 10000,
  },
];

const CORPORATE_ACTIONS: CorporateActionItem[] = [
  {
    id: 'ca-1',
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    type: 'Buyback',
    window: '01 Dec – 07 Dec',
    offerPrice: '₹4,150.00',
    status: 'Upcoming',
  },
  {
    id: 'ca-2',
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    type: 'OFS',
    window: '25 Nov – 26 Nov',
    offerPrice: '₹1,420.00',
    status: 'Open',
  },
];

interface BidsViewProps {
  onNotify: (msg: string) => void;
}

export function BidsView({ onNotify }: BidsViewProps) {
  const [subTab, setSubTab] = useState<BidsSubTab>('ipo');
  const [search, setSearch] = useState('');
  const [applyModal, setApplyModal] = useState<IpoItem | null>(null);
  const [lots, setLots] = useState(1);
  const [upiId, setUpiId] = useState('trader@okicici');
  const [appliedBids, setAppliedBids] = useState<AppliedBid[]>([]);
  const [gsecApplied, setGsecApplied] = useState<string[]>([]);

  const query = search.trim().toLowerCase();

  const filteredIpos = IPO_LIST.filter(
    (item) =>
      !query ||
      item.symbol.toLowerCase().includes(query) ||
      item.company.toLowerCase().includes(query),
  );

  const filteredGsecs = GSEC_LIST.filter(
    (item) =>
      !query ||
      item.symbol.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query),
  );

  function handleSubmitIpoBid(e: React.FormEvent) {
    e.preventDefault();
    if (!applyModal) return;
    const validLots = Math.max(1, Math.min(13, Number(lots) || 1));
    const amount = validLots * applyModal.lotSize * applyModal.cutoffPrice;
    const bid: AppliedBid = {
      id: applyModal.id,
      symbol: applyModal.symbol,
      lots: validLots,
      price: applyModal.cutoffPrice,
      amount,
      upiId: upiId.trim() || 'trader@okicici',
      submittedAt: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setAppliedBids((prev) => [bid, ...prev.filter((b) => b.id !== bid.id)]);
    onNotify(`Paper IPO bid placed for ${applyModal.symbol} (${validLots} lot${validLots > 1 ? 's' : ''}).`);
    setApplyModal(null);
    setLots(1);
  }

  return (
    <div className="p-5 lg:p-9 max-w-[1100px] space-y-6">
      {/* Sub-navigation bar matching Kite Bids */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div className="flex items-center gap-6 overflow-x-auto">
          {(
            [
              ['ipo', 'IPO'],
              ['gsec', 'Govt. securities'],
              ['auctions', 'Auctions'],
              ['corporate', 'Corporate actions'],
            ] as const
          ).map(([id, label]) => {
            const active = subTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={`relative pb-3 text-[13px] whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'text-[#FF5722] font-medium'
                    : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#444444] dark:hover:text-[#E0E0E0]'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
                )}
              </button>
            );
          })}
        </div>

        {(subTab === 'ipo' || subTab === 'gsec') && (
          <div className="relative pb-2 sm:pb-2.5 w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-2.5 top-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instrument"
              className="w-full pl-8 pr-3 py-1 text-xs border border-[#E5E5E5] dark:border-[#303030] rounded-[2px] bg-white dark:bg-[#1A1A1A] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3]"
            />
          </div>
        )}
      </div>

      {/* IPO Table */}
      {subTab === 'ipo' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
              IPOs ({filteredIpos.length})
            </h1>
            <span className="text-xs text-[#9B9B9B]">Simulated paper IPO applications</span>
          </div>

          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2.5 px-3 font-normal">Instrument</th>
                  <th className="py-2.5 px-3 font-normal">Date</th>
                  <th className="py-2.5 px-3 font-normal text-right">Price (₹)</th>
                  <th className="py-2.5 px-3 font-normal text-right">Min. amount (₹)</th>
                  <th className="py-2.5 px-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {filteredIpos.map((ipo) => {
                  const applied = appliedBids.find((b) => b.id === ipo.id);
                  return (
                    <tr
                      key={ipo.id}
                      className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                            {ipo.symbol}
                          </span>
                          <span className="text-[10px] uppercase text-[#9B9B9B]">
                            {ipo.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9B9B9B] mt-0.5">{ipo.company}</div>
                      </td>
                      <td className="py-3 px-3 text-[#444444] dark:text-[#CCCCCC] tabular-nums">
                        {ipo.dateRange}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {ipo.priceRange}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="text-[#444444] dark:text-[#E0E0E0]">
                          {formatINR(ipo.minAmount)}
                        </div>
                        <div className="text-[10px] text-[#9B9B9B]">{ipo.lotSize} Qty.</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {applied ? (
                          <span className="inline-flex items-center gap-1 text-[#4CAF50] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Applied ({applied.lots}L)</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setApplyModal(ipo);
                              setLots(1);
                            }}
                            className={`px-3 py-1 rounded-[2px] text-xs font-medium text-white cursor-pointer transition-colors ${
                              ipo.status === 'Ongoing'
                                ? 'bg-[#4184F3] hover:bg-[#3367D6]'
                                : 'bg-[#666666] hover:bg-[#444444]'
                            }`}
                          >
                            {ipo.status === 'Ongoing' ? 'Apply' : 'Pre-apply'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {appliedBids.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]">
                My Applications ({appliedBids.length})
              </h2>
              <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                      <th className="py-2 px-3 font-normal">Symbol</th>
                      <th className="py-2 px-3 font-normal">UPI ID</th>
                      <th className="py-2 px-3 font-normal text-right">Lots</th>
                      <th className="py-2 px-3 font-normal text-right">Amount</th>
                      <th className="py-2 px-3 font-normal text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                    {appliedBids.map((bid) => (
                      <tr key={bid.id}>
                        <td className="py-2.5 px-3 font-medium text-[#444444] dark:text-[#E0E0E0]">
                          {bid.symbol}
                        </td>
                        <td className="py-2.5 px-3 text-[#666666] dark:text-[#A0A0A0]">
                          {bid.upiId}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{bid.lots}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatINR(bid.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#4CAF50] font-medium">
                          Submitted · {bid.submittedAt}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Govt Securities Table */}
      {subTab === 'gsec' && (
        <div className="space-y-4">
          <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            Govt. securities ({filteredGsecs.length})
          </h1>
          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2.5 px-3 font-normal">Type</th>
                  <th className="py-2.5 px-3 font-normal">Instrument</th>
                  <th className="py-2.5 px-3 font-normal text-right">Indicative yield</th>
                  <th className="py-2.5 px-3 font-normal text-right">Order ends</th>
                  <th className="py-2.5 px-3 font-normal text-right">Min. investment</th>
                  <th className="py-2.5 px-3 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {filteredGsecs.map((g) => {
                  const placed = gsecApplied.includes(g.id);
                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors"
                    >
                      <td className="py-3 px-3 text-[#666666] dark:text-[#A0A0A0]">{g.type}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                          {g.symbol}
                        </div>
                        <div className="text-[11px] text-[#9B9B9B]">{g.name}</div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#4CAF50] font-medium">
                        {g.indicativeYield}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#CCCCCC]">
                        {g.endDate}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {formatINR(g.minInvestment)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {placed ? (
                          <span className="text-[#4CAF50] font-medium">Bid placed</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setGsecApplied((prev) => [...prev, g.id]);
                              onNotify(`Simulated G-Sec bid placed for ${g.symbol}.`);
                            }}
                            className="px-3 py-1 rounded-[2px] text-xs font-medium bg-[#4184F3] hover:bg-[#3367D6] text-white cursor-pointer"
                          >
                            Place bid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auctions Empty State */}
      {subTab === 'auctions' && (
        <div className="py-12 text-center space-y-2 border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <p className="text-[14px] text-[#444444] dark:text-[#E0E0E0]">
            No stocks are eligible for the T+1 auction session right now.
          </p>
          <p className="text-xs text-[#9B9B9B]">
            Auction markets open between 2:00 PM and 2:45 PM IST for short-delivered holdings.
          </p>
        </div>
      )}

      {/* Corporate Actions */}
      {subTab === 'corporate' && (
        <div className="space-y-4">
          <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            Corporate actions ({CORPORATE_ACTIONS.length})
          </h1>
          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2.5 px-3 font-normal">Instrument</th>
                  <th className="py-2.5 px-3 font-normal">Type</th>
                  <th className="py-2.5 px-3 font-normal">Window</th>
                  <th className="py-2.5 px-3 font-normal text-right">Offer price</th>
                  <th className="py-2.5 px-3 font-normal text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {CORPORATE_ACTIONS.map((ca) => (
                  <tr key={ca.id} className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E]">
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                        {ca.symbol}
                      </div>
                      <div className="text-[11px] text-[#9B9B9B]">{ca.name}</div>
                    </td>
                    <td className="py-3 px-3 text-[#666666] dark:text-[#A0A0A0]">{ca.type}</td>
                    <td className="py-3 px-3 tabular-nums text-[#444444] dark:text-[#CCCCCC]">
                      {ca.window}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {ca.offerPrice}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-[#4184F3]">
                      {ca.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IPO Application Modal */}
      {applyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ipo-apply-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1C] border border-[#E5E5E5] dark:border-[#303030] rounded shadow-xl overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#4184F3] text-white">
              <div>
                <h2 id="ipo-apply-title" className="text-[14px] font-medium">
                  Apply IPO · {applyModal.symbol}
                </h2>
                <div className="text-[11px] text-white/85">{applyModal.company}</div>
              </div>
              <button
                type="button"
                onClick={() => setApplyModal(null)}
                aria-label="Close IPO modal"
                className="p-1 hover:bg-white/15 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitIpoBid} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[#666666] dark:text-[#A0A0A0]">Lots (1–13)</span>
                  <input
                    type="number"
                    min={1}
                    max={13}
                    value={lots}
                    onChange={(e) => setLots(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0] tabular-nums"
                  />
                </label>

                <div className="space-y-1">
                  <span className="text-[#666666] dark:text-[#A0A0A0]">Cutoff price</span>
                  <div className="px-2.5 py-1.5 border border-[#EEEEEE] dark:border-[#2A2A2A] rounded-[2px] bg-[#F9F9F9] dark:bg-[#181818] tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                    ₹{applyModal.cutoffPrice} ({applyModal.lotSize} qty/lot)
                  </div>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-[#666666] dark:text-[#A0A0A0]">UPI ID (simulated)</span>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0]"
                />
              </label>

              <div className="flex items-center justify-between pt-3 border-t border-[#EEEEEE] dark:border-[#282828]">
                <div>
                  <div className="text-[11px] text-[#9B9B9B]">Amount payable</div>
                  <div className="text-[14px] font-medium tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                    {formatINR(
                      Math.max(1, lots || 1) * applyModal.lotSize * applyModal.cutoffPrice,
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApplyModal(null)}
                    className="px-3.5 py-1.5 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] text-[#666666] dark:text-[#A0A0A0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#4184F3] hover:bg-[#3367D6] text-white font-medium rounded-[2px] cursor-pointer"
                  >
                    Submit bid
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

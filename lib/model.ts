// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures, in three steps (model radar-2):
//
//   1. Peer calibration. The snapshot's live-token protocols are the market's own revealed prices.
//      A log-log regression of market cap on TVL over every live, non-CEX peer with a positive
//      market cap (computed from the snapshot at run time, peers in slug order, so the fit is
//      deterministic) gives  peerBase = exp(intercept) x tvl_usd ^ slope.  In this snapshot the
//      slope is about 0.47, far below 1: the market pays a falling multiple on each extra TVL
//      dollar as protocols grow, so a flat TVL multiple (the house radar-1 used 0.25 x TVL)
//      systematically overvalues the largest protocols against what peers actually trade for.
//   2. Momentum tilt. growth = clamp(change_7d, -30, 30); growthMult = 1 + (growth/100) x 0.35.
//      The clamp is tighter than radar-1's -60..120 and the weight lower: one week of TVL change
//      is a noisy signal, and in this snapshot the residual correlation between change_7d and
//      peer value is near zero, so momentum may reorder neighbours but never dominate size.
//   3. Maturity tilt. maturity = 0.8 + 0.2 x log1p(min(age_days, 1095)) / log1p(1095)
//      (age_days unknown: 365). A log curve, not radar-1's linear 0.6..1.0 ramp: the first months
//      of tracked history prove the most, and a young protocol is no longer taxed 40% for its age.
//
//   implied = max(1, round(peerBase x growthMult x maturity))
//
// Every constant and the fitted coefficients are stated in the dashboard. No protocol name is
// ever special-cased: the same function scores every row, and live-token protocols are set
// apart, never ranked: their market cap is a fact, not a model output.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's tilt constants, as the dashboard states them. The peer fit is not a constant: it is computed from the snapshot. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.35,
  growth_floor: -30,
  growth_cap: 30,
  maturity_floor: 0.8,
  maturity_range: 0.2,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** The peer calibration: a log-log fit of live-token market cap on TVL, from the snapshot itself. */
export interface PeerFit {
  peers: number;
  intercept: number;
  slope: number;
  r2: number;
}

/** The fallback fit if a snapshot carried no usable live peer: radar-1's flat 0.25 x TVL. */
export const FALLBACK_FIT: PeerFit = { peers: 0, intercept: Math.log(0.25), slope: 1, r2: 0 };

/**
 * Fit log(mcap) = intercept + slope x log(TVL) over the snapshot's live-token, non-CEX protocols
 * with a positive market cap, in slug order so the floating-point sums are run-identical.
 */
export function peerFit(snapshot: Snapshot): PeerFit {
  const peers = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX')
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (peers.length < 8) return FALLBACK_FIT;
  const xs = peers.map((p) => Math.log(p.tvl_usd));
  const ys = peers.map((p) => Math.log(p.mcap_usd as number));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  let ss = 0;
  let st = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i]! - my);
    den += (x - mx) * (x - mx);
  });
  if (den === 0) return FALLBACK_FIT;
  const slope = num / den;
  const intercept = my - slope * mx;
  ys.forEach((y, i) => {
    const f = intercept + slope * xs[i]!;
    ss += (y - f) * (y - f);
    st += (y - my) * (y - my);
  });
  return { peers: peers.length, intercept, slope, r2: st === 0 ? 0 : 1 - ss / st };
}

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  peer_fit: PeerFit;
  model_version: string;
  watchlist_size: number;
  watchlist: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The peer base, the two tilts and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants, fit: PeerFit): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.log1p(Math.min(Math.max(ageForModel, 0), model.maturity_days)) / Math.log1p(model.maturity_days)) * model.maturity_range;
  const base = Math.exp(fit.intercept) * Math.pow(protocol.tvl_usd, fit.slope);
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, base, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL, fit: PeerFit = peerFit(snapshot)): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const { implied, base, growthPct, growthMult, maturityMult, age } = impliedValue(p, snapshot.as_of, model, fit);
    return { p, implied, base, growthPct, growthMult, maturityMult, age };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      base_multiple: round4(s.base / s.p.tvl_usd),
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's core action, in the words a farmer can follow. Amounts are the position split's core share. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC as collateral to ${name} on ${chain}, then borrow no more than 30% against it so the health factor stays safely above liquidation.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} split evenly between USDC and the pool's paired asset as liquidity in ${name}'s main ${chain} pool, and keep the LP position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC from Ethereum to ${chain} through ${name}, then make one real transfer or swap with the bridged funds inside its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the staking receipt token in the same wallet, unstaked.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name}, open one small hedged position at no more than 2x, and leave the margin account funded.`;
  if (c.includes('prediction')) return `Fund ${name} with $${capital} and take one position in its most liquid market, sized so a total loss still leaves the wallet active.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into the largest ${name} vault on ${chain} by vault TVL, keep the vault shares, and do not rotate between vaults more than once a month.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold the issued stablecoin in the farming wallet.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} with USDC and hold it so the position accrues across weekly snapshots.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for the longest term offered under 90 days and keep the policy NFT in the wallet.`;
  if (c.includes('payment')) return `Route $${capital} of real payments through ${name} in at least four separate transactions across the hold period, not one lump sum.`;
  if (c.includes('chain')) return `Fund the wallet on ${name} with $${capital}, use two native apps in its ecosystem in the first week, and keep a balance above $25 for the whole hold.`;
  return `Deposit $${capital} of USDC into ${name}'s main product on ${chain} and keep the position open for the full hold period.`;
}

/** A second, different qualifying action so the wallet's history is not one deposit and silence. */
function secondActionFor(p: SnapshotProtocol, capital: number): string {
  const c = (p.category ?? '').toLowerCase();
  const second = p.chains.length > 1 ? p.chains[1]! : null;
  const small = Math.max(10, Math.round(capital * 0.3));
  if (second !== null) return `Repeat a smaller $${small} position on ${second}, the protocol's second chain, so the wallet shows genuine multi-chain use rather than a single deposit.`;
  if (c.includes('lend') || c.includes('cdp')) return `Make one $${small} repayment-and-reborrow cycle against the collateral so the wallet records borrowing activity, not only supplying.`;
  if (c.includes('dex')) return `Make three swaps of about $${small} each through the same pool on different days, so the wallet records trading activity as well as liquidity.`;
  if (c.includes('curator') || c.includes('allocator')) return `Add a second $${small} deposit four weeks later, after the first snapshot cycle, so the position grows instead of sitting static.`;
  return `Make one further $${small} qualifying transaction two weeks after the first, on a different day and in a different week, so the activity spans more than one snapshot.`;
}

/**
 * A protocol's farm plan: eight steps, each a concrete action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, 7-day TVL change), never
 * from a hand-written list of names: research and wallet hygiene, a category-specific core
 * position at 70% of the capital tier, a second qualifying action, a weekly cadence, a mid-hold
 * risk review keyed to the protocol's own TVL trend, and a disciplined claim-and-unwind exit.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const core = Math.round(capital * 0.7);
  const hold = holdDaysFor(age);
  const trend = p.change_7d === null ? 'was not reported in the snapshot' : `${p.change_7d >= 0 ? 'rose' : 'fell'} ${Math.abs(p.change_7d).toFixed(1)}% in the snapshot's last 7 days`;
  return [
    {
      text: `Research first: read ${p.name}'s own documentation and its DefiLlama category (${p.category ?? 'uncategorised'}), confirm it still has no live token, and copy every contract address from the protocol's official page only, never from a search ad or a reply.`,
      cost: '$0, research only',
      time: '20 minutes',
    },
    {
      text: `Create a fresh wallet that holds only the funds you plan to farm ${p.name} with, write its seed phrase on paper offline, and fund it with $${capital} plus gas money on ${chain}.`,
      cost: `$${capital} of capital plus under $3 of gas to fund`,
      time: '10 minutes',
    },
    {
      text: actionFor(p, core, chain),
      cost: `$${core} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital),
      cost: `about $${Math.max(10, Math.round(capital * 0.3))} of capital and about $2 of gas`,
      time: '10 minutes, in week 2',
    },
    {
      text: `Keep a weekly cadence for the whole hold: one small qualifying action a week (a deposit top-up, a swap, a vote or a claim check-in) on the same weekday, so the wallet never looks like a one-day airdrop grab.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Log every transaction the day it happens: date, action, amount, transaction hash and gas paid, in one farm log for ${p.name}; the log is what lets you prove the activity was yours and repeat or unwind it later.`,
      cost: 'nothing but the log',
      time: '5 minutes per transaction',
    },
    {
      text: `Mid-hold risk review at day ${Math.round(hold / 2)}: ${p.name}'s TVL ${trend}; recheck its TVL and announcements, and exit early if TVL has fallen more than 25% since entry, the app is paused, or a contract migration is announced.`,
      cost: '$0 to review, gas only if you exit',
      time: '15 minutes',
    },
    {
      text: `Hold the position for the full ${hold} days, then claim any points or rewards only from the link ${p.name} itself publishes (never pay a fee to claim), and unwind in two tranches a week apart rather than in one exit.`,
      cost: `the $${capital} stays in the position until the hold ends`,
      time: `${hold} days, then 15 minutes to unwind`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const fit = peerFit(snapshot);
  const board = buildBoard(snapshot, model, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    peer_fit: { peers: fit.peers, intercept: round4(fit.intercept), slope: round4(fit.slope), r2: round4(fit.r2) },
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    watchlist: snapshot.watchlist,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

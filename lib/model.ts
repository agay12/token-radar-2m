// Token Radar's model, revision 2 ("radar-2-m"): one snapshot of the protocol universe in, one
// ranked board out. The board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and adds the strongest pre-token protocols below the watchlist floor: the early rows the
// radar exists to find. A protocol is pre-token when its snapshot record carries no token at all
// (no market cap, no CoinGecko id, no symbol); protocols whose token already trades are kept apart
// in the Live token view and never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures — TVL, seven-day growth, age with no
// token, chain spread and the protocol's DefiLlama category. No protocol name is ever special-cased:
// the same function scores every row.
//
//   category_ratio = the value-per-TVL ratio the category's own business earns (a perp venue's fees
//                    per dollar of TVL out-earn a bridge's); CATEGORY_RATIOS, default DEFAULT_RATIO.
//   growth_mult    = 1 + clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP) / 100 x GROWTH_WEIGHT
//   maturity_mult  = MATURITY_FLOOR + min(age_days, MATURITY_DAYS) / MATURITY_DAYS x MATURITY_RANGE
//                    (age unknown: UNKNOWN_AGE_DAYS). Age is how long the protocol has run with no
//                    token: the longer the record, the more established the business the token would
//                    claim, so maturity credits age — capped at four years so a decade-old name does
//                    not dominate.
//   spread_mult    = 1 + min(chains, SPREAD_CAP) x SPREAD_WEIGHT  (each live chain is a distribution
//                    surface a launch would land on).
//   implied        = max(1, round(tvl_usd x category_ratio x growth_mult x maturity_mult x spread_mult))
//
// Every constant is exported, stated on the dashboard, and re-derived per row in the page so the
// code and the numbers a reader sees are the same arithmetic.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  default_ratio: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  spread_weight: number;
  spread_cap: number;
}

export const MODEL: ModelConstants = {
  default_ratio: 0.1,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  spread_weight: 0.015,
  spread_cap: 6,
};

/** Value-per-TVL ratios by DefiLlama category, lowercase-matched on a keyword. */
export const CATEGORY_RATIOS: { match: string[]; ratio: number; note: string }[] = [
  { match: ['perp', 'leveraged'], ratio: 0.22, note: 'trading fees on leveraged flow' },
  { match: ['dex'], ratio: 0.18, note: 'swap fees' },
  { match: ['lend', 'cdp', 'collateral'], ratio: 0.15, note: 'interest spread' },
  { match: ['yield', 'vault', 'curator', 'allocator'], ratio: 0.14, note: 'management and performance fees' },
  { match: ['liquid staking', 'liquid restaking', 'restak'], ratio: 0.12, note: 'staking commission' },
  { match: ['derivative', 'options', 'structured'], ratio: 0.12, note: 'derivative fees' },
  { match: ['rwa', 'private credit'], ratio: 0.1, note: 'origination and servicing fees' },
  { match: ['prediction'], ratio: 0.1, note: 'market maker spread' },
  { match: ['stablecoin'], ratio: 0.09, note: 'reserve yield share' },
  { match: ['bridge', 'interoperability'], ratio: 0.08, note: 'bridging fees' },
  { match: ['insurance'], ratio: 0.08, note: 'premium float' },
  { match: ['infrastructure', 'wallet', 'rpc'], ratio: 0.07, note: 'service fees' },
  { match: ['launchpad', 'nft', 'gaming'], ratio: 0.06, note: 'listing and marketplace fees' },
];

/** The ratio one category earns: the first keyword group that matches, else DEFAULT_RATIO. */
export function categoryRatio(category: string | null): number {
  const c = (category ?? '').toLowerCase();
  for (const row of CATEGORY_RATIOS) {
    if (row.match.some((k) => c.includes(k))) return row.ratio;
  }
  return MODEL.default_ratio;
}

/** A short note on what the category's token would earn from, for the dashboard. */
export function categoryNote(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  for (const row of CATEGORY_RATIOS) {
    if (row.match.some((k) => c.includes(k))) return row.note;
  }
  return 'its core service fees';
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2-m';

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
  on_watchlist: boolean;
  implied_value_usd: number;
  model: {
    category_ratio: number;
    category_note: string;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    spread_multiplier: number;
  };
  farm_steps: string[];
}

/** The dashboard's view of one row: the snapshot figures plus the model's own outputs. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  on_watchlist: boolean;
  implied_value_usd: number;
  category_ratio: number;
  category_note: string;
  growth_multiplier: number;
  maturity_multiplier: number;
  spread_multiplier: number;
  farm_steps: string[];
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
  model_version: string;
  category_ratios: { match: string[]; ratio: number; note: string }[];
  watchlist_size: number;
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

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): { implied: number; ratio: number; note: string; growthPct: number; growthMult: number; maturityMult: number; spreadMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const ratio = categoryRatio(protocol.category);
  const note = categoryNote(protocol.category);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const spreadMult = 1 + Math.min(protocol.chains.length, model.spread_cap) * model.spread_weight;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * ratio * growthMult * maturityMult * spreadMult));
  return { implied, ratio, note, growthPct, growthMult, maturityMult, spreadMult, age };
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

/** The protocols the board ranks, strongest implied value first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is on the board.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model) }));
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
    token_status: 'pre-token' as const,
    age_days: s.age,
    on_watchlist: snapshot.watchlist.includes(s.p.slug),
    implied_value_usd: s.implied,
    model: {
      category_ratio: s.ratio,
      category_note: s.note,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
      spread_multiplier: round4(s.spreadMult),
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
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('perp') || c.includes('leveraged')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small position.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s most traded pool on ${chain} and keep the LP receipt.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and leave it in the supply market.`;
  if (c.includes('yield') || c.includes('vault') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into ${name}'s flagship vault on ${chain} and keep the share token.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('derivative') || c.includes('options') || c.includes('structured')) return `Buy one small $${capital} position through ${name} on ${chain} and hold it to expiry.`;
  if (c.includes('rwa') || c.includes('private credit')) return `Mint or subscribe $${capital} of ${name}'s yield asset on ${chain} and hold it.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position on ${name}'s headline market.`;
  if (c.includes('stablecoin')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('bridge') || c.includes('interoperability')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the funds in its app.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('infrastructure') || c.includes('wallet') || c.includes('rpc')) return `Use ${name}'s service on ${chain} as a paying customer and record the account.`;
  if (c.includes('launchpad') || c.includes('nft') || c.includes('gaming')) return `Trade or mint through ${name} on ${chain} and keep the receipts.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const second = p.chains.length > 1 ? p.chains[1]! : null;
  const steps: FarmStep[] = [
    { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: action, cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week — a deposit, a borrow, a swap, a vote or a trade — so the wallet shows sustained use.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity spans more than one snapshot, and vary the hours you transact.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
  ];
  if (second !== null) {
    steps.push({ text: `Repeat the main action once on ${name2(p)}'s ${second} deployment with $${Math.round(capital / 2)}, so the wallet is active on more than one chain.`, cost: `$${Math.round(capital / 2)} more of capital and about $6 of gas`, time: '20 minutes' });
  } else {
    steps.push({ text: `Explore ${name2(p)}'s secondary features (a limit order, a borrow against the position, a governance vote) so the wallet touches more than the entry route.`, cost: 'about $3 of extra gas', time: '15 minutes' });
  }
  steps.push(
    { text: `Before you withdraw, open ${name2(p)}'s own points or rewards page and claim only from the link it publishes; never pay anyone to claim.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it on demand.`, cost: 'nothing but the log', time: '5 minutes' },
  );
  return steps;
}

function name2(p: SnapshotProtocol): string {
  return p.name;
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

/** A board row's compact form for data.js, with the farm plan carried beside the model's outputs. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    on_watchlist: row.on_watchlist,
    implied_value_usd: row.implied_value_usd,
    category_ratio: row.model.category_ratio,
    category_note: row.model.category_note,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    spread_multiplier: row.model.spread_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    category_ratios: CATEGORY_RATIOS,
    watchlist_size: snapshot.watchlist.length,
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
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100 the gate asks`;
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

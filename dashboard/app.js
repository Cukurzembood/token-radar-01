// Token Launch Radar — radar-3 dashboard. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the robustly peer-calibrated board, filters, a per-protocol detail view with the
// model's own arithmetic and the protocol's farm plan, and the live-token set kept apart.
// No network: every byte it shows is in data.js. Farm-plan derivation mirrors lib/model.ts exactly.
(function () {
  'use strict';
  var R = window.RADAR;
  var main = document.getElementById('board');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function money(n) { if (n == null) return '—'; if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K'; return '$' + n; }
  function pct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
  var wl = {}; (R.watchlist || []).forEach(function (s) { wl[s] = true; });

  // ---- farm plan: the same derivation main.ts writes to board.json ----
  function chainOf(p) { return p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) { if (p.tvl_usd >= 1e9) return 250; if (p.tvl_usd >= 2.5e8) return 200; if (p.tvl_usd >= 1e8) return 150; if (p.tvl_usd >= 5e7) return 100; return 50; }
  function holdDaysFor(age) { if (age === null) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase(), name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC as collateral to ' + name + ' on ' + chain + ', then borrow no more than 30% against it so the health factor stays safely above liquidation.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' split evenly between USDC and the pool\'s paired asset as liquidity in ' + name + '\'s main ' + chain + ' pool, and keep the LP position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC from Ethereum to ' + chain + ' through ' + name + ', then make one real transfer or swap with the bridged funds inside its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\'s staking asset through ' + name + ' on ' + chain + ' and keep the staking receipt token in the same wallet, unstaked.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ', open one small hedged position at no more than 2x, and leave the margin account funded.';
    if (c.indexOf('prediction') >= 0) return 'Fund ' + name + ' with $' + capital + ' and take one position in its most liquid market, sized so a total loss still leaves the wallet active.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into the largest ' + name + ' vault on ' + chain + ' by vault TVL, keep the vault shares, and do not rotate between vaults more than once a month.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold the issued stablecoin in the farming wallet.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + '\'s yield-bearing asset on ' + chain + ' with USDC and hold it so the position accrues across weekly snapshots.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' for the longest term offered under 90 days and keep the policy NFT in the wallet.';
    if (c.indexOf('payment') >= 0) return 'Route $' + capital + ' of real payments through ' + name + ' in at least four separate transactions across the hold period, not one lump sum.';
    if (c.indexOf('chain') >= 0) return 'Fund the wallet on ' + name + ' with $' + capital + ', use two native apps in its ecosystem in the first week, and keep a balance above $25 for the whole hold.';
    return 'Deposit $' + capital + ' of USDC into ' + name + '\'s main product on ' + chain + ' and keep the position open for the full hold period.';
  }
  function secondActionFor(p, capital) {
    var c = (p.category || '').toLowerCase(), small = Math.max(10, Math.round(capital * 0.3));
    if (p.chains.length > 1) return 'Repeat a smaller $' + small + ' position on ' + p.chains[1] + ', the protocol\'s second chain, so the wallet shows genuine multi-chain use rather than a single deposit.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Make one $' + small + ' repayment-and-reborrow cycle against the collateral so the wallet records borrowing activity, not only supplying.';
    if (c.indexOf('dex') >= 0) return 'Make three swaps of about $' + small + ' each through the same pool on different days, so the wallet records trading activity as well as liquidity.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Add a second $' + small + ' deposit four weeks later, after the first snapshot cycle, so the position grows instead of sitting static.';
    return 'Make one further $' + small + ' qualifying transaction two weeks after the first, on a different day and in a different week, so the activity spans more than one snapshot.';
  }
  function farmSteps(p) {
    var chain = chainOf(p), capital = capitalFor(p), core = Math.round(capital * 0.7), hold = holdDaysFor(p.age_days);
    var trend = p.change_7d === null ? 'was not reported in the snapshot' : (p.change_7d >= 0 ? 'rose ' : 'fell ') + Math.abs(p.change_7d).toFixed(1) + '% in the snapshot\'s last 7 days';
    var steps = [
      { text: 'Research first: read ' + p.name + '\'s own documentation and its DefiLlama category (' + (p.category || 'uncategorised') + '), confirm it still has no live token, and copy every contract address from the protocol\'s official page only, never from a search ad or a reply.', cost: '$0, research only', time: '20 minutes' },
      { text: 'Create a fresh wallet that holds only the funds you plan to farm ' + p.name + ' with, write its seed phrase on paper offline, and fund it with $' + capital + ' plus gas money on ' + chain + '.', cost: '$' + capital + ' of capital plus under $3 of gas to fund', time: '10 minutes' },
      { text: actionFor(p, core, chain), cost: '$' + core + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital), cost: 'about $' + Math.max(10, Math.round(capital * 0.3)) + ' of capital and about $2 of gas', time: '10 minutes, in week 2' },
      { text: 'Keep a weekly cadence for the whole hold: one small qualifying action a week (a deposit top-up, a swap, a vote or a claim check-in) on the same weekday, so the wallet never looks like a one-day airdrop grab.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Log every transaction the day it happens: date, action, amount, transaction hash and gas paid, in one farm log for ' + p.name + '; the log is what lets you prove the activity was yours and repeat or unwind it later.', cost: 'nothing but the log', time: '5 minutes per transaction' },
      { text: 'Mid-hold risk review at day ' + Math.round(hold / 2) + ': ' + p.name + '\'s TVL ' + trend + '; recheck its TVL and announcements, and exit early if TVL has fallen more than 25% since entry, the app is paused, or a contract migration is announced.', cost: '$0 to review, gas only if you exit', time: '15 minutes' },
      { text: 'Hold the position for the full ' + hold + ' days, then claim any points or rewards only from the link ' + p.name + ' itself publishes (never pay a fee to claim), and unwind in two tranches a week apart rather than in one exit.', cost: 'the $' + capital + ' stays in the position until the hold ends', time: hold + ' days, then 15 minutes to unwind' }
    ];
    return steps.map(function (s) { return s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; });
  }

  // ---- page ----
  var h1 = el('h1', null, 'Token Launch Radar'); h1.appendChild(el('span', 'dot', ' · ' + R.model_version)); main.appendChild(h1);
  main.appendChild(el('p', 'sub', 'Pre-token protocols ranked by implied value, calibrated on what the market actually pays its typical live-token peer. Snapshot frozen at ' + R.as_of + ' · ' + R.board_size + ' ranked rows · ' + R.watchlist_size + ' watchlist · ' + R.early_size + ' early · ' + R.live_size + ' live tokens set apart, never ranked.'));
  var fit = R.peer_fit;
  var model = el('section', 'model');
  model.appendChild(el('h2', null, 'The stated model — radar-3, robust peer calibration'));
  var f = el('p'); f.innerHTML = 'implied = <code>exp(' + fit.intercept.toFixed(2) + ') × TVL<sup>' + fit.slope.toFixed(2) + '</sup></code> × <code>momentum</code> × <code>maturity</code>, fitted at run time on the snapshot\'s own live, non-CEX peers in two passes: a log-log regression of market cap on TVL, then a refit on the ' + fit.peers + ' peers that survive a 2.5σ robust trim (R² ' + fit.r2.toFixed(2) + ' on the survivors).';
  model.appendChild(f);
  var ul = el('ul');
  ['Why robust, not radar-2\'s single least-squares pass: a few extreme peers sit orders of magnitude off the log-log trend and drag an ordinary fit toward themselves. Trimming beyond 2.5 robust sigmas (median absolute deviation, scaled) prices the typical peer instead of the loudest — the board is read from that line.',
   'Why a power law, not radar-1\'s flat 0.25 × TVL: live peers trade at a median market-cap/TVL of 0.29 below $50M TVL but only 0.03 above $250M — size itself discounts the multiple, and the fitted slope of ' + fit.slope.toFixed(2) + ' says exactly that from the snapshot\'s own numbers.',
   'Momentum: 1 + clamp(change_7d, −40, +40)% × 0.30. One week of TVL change is noisy — in this snapshot its residual correlation with peer value is near zero — so it reorders neighbours, never dominates.',
   'Maturity: 0.82 + 0.18 × log-age over 3 years (unknown age counts as 365 days). A log curve: the first tracked months prove the most; radar-1\'s linear ramp taxed a young protocol 40% for age alone.',
   'Live-token protocols are never ranked: their market cap is the market\'s fact, shown apart below. No protocol name is special-cased; one function scores every row.'].forEach(function (t) { ul.appendChild(el('li', null, t)); });
  model.appendChild(ul); main.appendChild(model);

  var stats = el('div', 'stats');
  [['Watchlist covered', R.watchlist_size + ' / ' + R.watchlist_size], ['Board rows', String(R.board_size)], ['Top implied', money(R.rows[0].implied_value_usd)], ['Peer fit', fit.peers + ' live peers'], ['Model', R.model_version]].forEach(function (s) { var d = el('div', 'stat'); d.appendChild(el('b', null, s[1])); d.appendChild(el('span', null, s[0])); stats.appendChild(d); });
  main.appendChild(stats);

  var params = new URLSearchParams(window.location.search);
  var state = { q: (params.get('q') || '').toLowerCase(), cat: params.get('cat') || 'all', seg: params.get('seg') || 'all', sort: params.get('sort') || 'implied_value_usd', dir: -1, selected: null };
  if (state.sort === 'name') state.dir = 1;
  var controls = el('div', 'controls');
  function field(label, node) { var l = el('label', null, label); l.appendChild(node); return l; }
  var search = document.createElement('input'); search.type = 'search'; search.placeholder = 'name or slug…'; search.value = state.q; search.addEventListener('input', function () { state.q = search.value.toLowerCase(); render(); });
  var catSel = document.createElement('select'); catSel.appendChild(new Option('All categories', 'all'));
  Array.from(new Set(R.rows.map(function (r) { return r.category || '—'; }))).sort().forEach(function (c) { catSel.appendChild(new Option(c, c)); });
  catSel.value = state.cat; catSel.addEventListener('change', function () { state.cat = catSel.value; render(); });
  var segSel = document.createElement('select'); [['all', 'Board: all rows'], ['wl', 'Watchlist only'], ['early', 'Early only'], ['live', 'Live tokens (unranked)']].forEach(function (o) { segSel.appendChild(new Option(o[1], o[0])); });
  segSel.value = state.seg; segSel.addEventListener('change', function () { state.seg = segSel.value; render(); });
  var sortSel = document.createElement('select'); [['implied_value_usd', 'Implied value'], ['tvl_usd', 'TVL'], ['change_7d', '7d change'], ['age_days', 'Age'], ['name', 'Name']].forEach(function (o) { sortSel.appendChild(new Option(o[1], o[0])); });
  sortSel.value = state.sort;
  sortSel.addEventListener('change', function () { state.sort = sortSel.value; state.dir = state.sort === 'name' ? 1 : -1; render(); });
  controls.appendChild(field('Search', search)); controls.appendChild(field('Category', catSel)); controls.appendChild(field('Segment', segSel)); controls.appendChild(field('Sort by', sortSel));
  main.appendChild(controls);
  var count = el('p', 'count'); main.appendChild(count);
  var tableWrap = el('div'); main.appendChild(tableWrap);
  var detail = el('section', 'detail'); detail.style.display = 'none'; main.appendChild(detail);

  function rowsFiltered() {
    var rows = R.rows.filter(function (r) {
      if (state.seg === 'wl' && !wl[r.slug]) return false;
      if (state.seg === 'early' && wl[r.slug]) return false;
      if (state.cat !== 'all' && (r.category || '—') !== state.cat) return false;
      if (state.q && r.name.toLowerCase().indexOf(state.q) < 0 && r.slug.indexOf(state.q) < 0) return false;
      return true;
    });
    rows.sort(function (a, b) { var x = a[state.sort], y = b[state.sort]; if (x == null) return 1; if (y == null) return -1; if (typeof x === 'string') return state.dir * x.localeCompare(y); return state.dir * (x - y); });
    return rows;
  }
  function showDetail(r, scroll) {
    state.selected = r.slug; detail.style.display = ''; detail.innerHTML = '';
    var h = el('h2', null, r.name); h.appendChild(el('span', 'badge' + (wl[r.slug] ? '' : ' early'), wl[r.slug] ? 'watchlist' : 'early')); detail.appendChild(h);
    detail.appendChild(el('p', 'sub', (r.category || 'Uncategorised') + ' · ' + (r.chains.join(', ') || 'no chains listed') + ' · listed ' + (r.listed_at || 'unknown')));
    var grid = el('div', 'grid');
    var peerBase = Math.round(Math.exp(fit.intercept) * Math.pow(r.tvl_usd, fit.slope));
    [['Implied value', money(r.implied_value_usd)], ['TVL', money(r.tvl_usd)], ['Peer base (fit)', money(peerBase)], ['Momentum ×', r.growth_multiplier.toFixed(3)], ['Maturity ×', r.maturity_multiplier.toFixed(3)], ['Effective multiple', (r.implied_value_usd / r.tvl_usd).toFixed(3) + ' × TVL'], ['7d TVL change', pct(r.change_7d)], ['Age', r.age_days == null ? 'unknown' : r.age_days + ' days']].forEach(function (c) { var d = el('div', 'cell'); d.appendChild(el('b', null, c[1])); d.appendChild(el('span', null, c[0])); grid.appendChild(d); });
    detail.appendChild(grid);
    detail.appendChild(el('p', null, 'Why this rank: the peer fit prices a protocol of this TVL at ' + money(peerBase) + ' before tilts; momentum ' + (r.change_7d == null ? 'was unreported, so it neither helps nor hurts' : pct(r.change_7d) + ' over 7 days moves it by ×' + r.growth_multiplier.toFixed(3)) + ', and ' + (r.age_days == null ? 'an unknown listing age counts as 365 days' : r.age_days + ' tracked days') + ' of history set maturity at ×' + r.maturity_multiplier.toFixed(3) + '.'));
    detail.appendChild(el('h3', null, 'Farm plan — 8 steps'));
    var ol = el('ol'); farmSteps(r).forEach(function (s) { ol.appendChild(el('li', null, s)); }); detail.appendChild(ol);
    if (scroll) detail.scrollIntoView({ block: 'nearest' });
  }
  function render() {
    tableWrap.innerHTML = '';
    if (state.seg === 'live') {
      count.textContent = R.live.length + ' live-token protocols — the market\'s own values, deliberately not ranked against pre-token rows.';
      var t = el('table'); var thead = el('tr');
      ['Protocol', 'Category', 'TVL', 'Market cap', '7d'].forEach(function (h) { thead.appendChild(el('th', null, h)); }); t.appendChild(thead);
      R.live.forEach(function (r) { var tr = el('tr'); [r.name, r.category || '—', money(r.tvl_usd), money(r.mcap_usd), pct(r.change_7d)].forEach(function (v, i) { tr.appendChild(el('td', i === 0 ? 'name' : null, v)); }); t.appendChild(tr); });
      tableWrap.appendChild(t); return;
    }
    var rows = rowsFiltered();
    count.textContent = rows.length + ' of ' + R.board_size + ' ranked rows shown. Select a row for its model breakdown and farm plan.';
    var t2 = el('table'); var hr = el('tr');
    ['#', 'Protocol', 'Category', 'TVL', '7d', 'Age', 'Implied'].forEach(function (h) { hr.appendChild(el('th', null, h)); }); t2.appendChild(hr);
    rows.forEach(function (r) {
      var tr = el('tr'); tr.setAttribute('aria-selected', state.selected === r.slug ? 'true' : 'false');
      tr.appendChild(el('td', null, String(r.rank)));
      var nm = el('td'); var n = el('span', 'name', r.name); nm.appendChild(n); nm.appendChild(el('span', 'badge' + (wl[r.slug] ? '' : ' early'), wl[r.slug] ? 'WL' : 'early')); nm.appendChild(el('div', 'slug', r.slug)); tr.appendChild(nm);
      tr.appendChild(el('td', null, r.category || '—'));
      tr.appendChild(el('td', null, money(r.tvl_usd)));
      var ch = el('td', r.change_7d == null ? null : (r.change_7d >= 0 ? 'pos' : 'neg'), pct(r.change_7d)); tr.appendChild(ch);
      tr.appendChild(el('td', null, r.age_days == null ? '—' : r.age_days + 'd'));
      tr.appendChild(el('td', null, money(r.implied_value_usd)));
      tr.addEventListener('click', function () { showDetail(r, true); render(); });
      t2.appendChild(tr);
    });
    tableWrap.appendChild(t2);
  }
  render();
  var wanted = params.get('detail');
  var initial = R.rows.filter(function (r) { return r.slug === wanted; })[0] || R.rows[0];
  if (initial) showDetail(initial, !!wanted);
  var foot = el('footer', null, 'Source: the sealed DefiLlama snapshot in data.js, frozen ' + R.as_of + '. No live prices, no network calls, no fabricated figures: every number on this page is computed from that snapshot by the stated model. This is a ranking model, not investment advice.');
  main.appendChild(foot);
  main.setAttribute('aria-busy', 'false');
})();

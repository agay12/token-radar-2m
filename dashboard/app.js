// Token Radar 2M's page. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, sortable and filtered, a per-protocol detail dialog with the model's own inputs
// and the farm plan the board carries, and a Live token view. No network: every byte it shows is in
// data.js, and the page re-derives a row's implied value with the same arithmetic the model used.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var dialog = document.getElementById('detail');
  var state = { q: '', category: 'all', sort: 'implied', dir: -1, watchOnly: false, selected: null, tab: 'pre-token' };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var neg = n < 0; n = Math.abs(n);
    var s;
    if (n >= 1e9) s = '$' + (n / 1e9).toFixed(2) + 'B';
    else if (n >= 1e6) s = '$' + (n / 1e6).toFixed(1) + 'M';
    else if (n >= 1e3) s = '$' + Math.round(n / 1e3) + 'K';
    else s = '$' + Math.round(n);
    return neg ? '-' + s : s;
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unlisted';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model, re-derived per row: the page's arithmetic is the model's arithmetic, so the reader can
  // check any row on screen against board.json and find the same number.
  function impliedOf(r) {
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null || r.change_7d === undefined ? 0 : r.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = r.age_days === null || r.age_days === undefined ? m.unknown_age_days : r.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var spread = 1 + Math.min((r.chains || []).length, m.spread_cap) * m.spread_weight;
    return Math.max(1, Math.round(r.tvl_usd * r.category_ratio * growthMult * maturity * spread));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.on_watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.rank - b.rank;
    });
  }

  function masthead() {
    return el('header', { class: 'mast' },
      el('span', { class: 'logo', 'aria-hidden': 'true' }),
      el('span', { class: 'brand', text: 'TOKEN ' }),
      el('span', { class: 'brand', html: '<b>RADAR</b>' }),
      el('span', { class: 'mast-note', text: 'snapshot ' + DATA.as_of + ' · model ' + DATA.model_version + ' · no token dates are predicted' })
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', null, 'Pre-token protocols, ranked by the value a launch would ', el('span', { text: 'inherit today' })),
        el('p', { class: 'expl', html: 'The board takes every protocol the snapshot watches — $' + Math.round(DATA.floor_usd / 1e6) + 'M+ of TVL, no token on record, not a wrapped or staked product of one that trades — and adds ' + DATA.early_size + ' smaller pre-token protocols the watchlist floor leaves out. Implied value answers one question: if the protocol issued a token today and its record stayed as it is, what would that token plausibly be worth? It is a model, not a prediction, and no protocol name is special-cased.' })
      ),
      el('div', { class: 'stats' },
        stat('Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'pos'),
        stat('Rows ranked', String(DATA.board_size), 'sig'),
        stat('Early rows below floor', String(DATA.early_size), ''),
        stat('Live tokens set aside', String(DATA.live_size), '')
      )
    );
  }
  function stat(label, value, cls) {
    return el('div', { class: 'stat' }, el('span', { text: label }), el('b', { class: cls || null, text: value }));
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { var o = el('option', { value: c, text: c }); if (c === state.category) o.selected = true; return o; })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var sortSel = el('select', { id: 'sort', 'aria-label': 'Sort the board' });
    [['implied', 'Implied value'], ['tvl', 'TVL'], ['growth', '7-day growth'], ['age', 'Age with no token'], ['name', 'Name']].forEach(function (pair) {
      var o = el('option', { value: pair[0], text: pair[1] });
      if (pair[0] === state.sort) o.selected = true;
      sortSel.appendChild(o);
    });
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; state.dir = -1; render(); });
    var watch = el('input', { type: 'checkbox', id: 'watchonly' });
    if (state.watchOnly) watch.checked = true;
    watch.addEventListener('change', function () { state.watchOnly = watch.checked; render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'sort', text: 'Sort' }), sortSel),
      el('label', { class: 'toggle', for: 'watchonly' }, watch, el('span', { text: 'Watchlist only' })),
      el('span', { class: 'count', text: rows().length + ' of ' + DATA.board_size + ' rows shown' })
    );
  }

  function sortHeader(key, label) {
    return el('th', null,
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▾' : ' ▴' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search, pick another category, or untick watchlist-only to see the whole board.' }),
        el('button', { type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.watchOnly = false; writeHash(); render(); } })
      );
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'r' }, el('b', { text: '#' + r.rank })),
        el('td', { class: 'pname' },
          el('b', { text: r.name }),
          el('span', { text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') })
        ),
        el('td', null, el('span', { class: 'badge ' + (r.on_watchlist ? 'watch' : 'early'), text: r.on_watchlist ? 'watchlist' : 'early' })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: r.change_7d === null ? 'num' : (r.change_7d >= 0 ? 'pos num' : 'neg num'), text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num' },
          el('div', { class: 'vbar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { text: fmtUsd(r.implied_value_usd) })
        )
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'tablewrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model inputs and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            el('th', null, 'List'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value')
          )),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var ratios = DATA.category_ratios.map(function (row) {
      return el('tr', null, el('td', { text: row.match.join(', ') }), el('td', { class: 'num', text: '×' + row.ratio }), el('td', { text: row.note }));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed — model ' + DATA.model_version }),
      el('p', { text: 'One function scores every protocol from the snapshot\'s own figures; nothing is hand-picked and no name is special-cased.' }),
      el('div', { class: 'formula', text:
        'implied = tvl_usd\n        × category_ratio                       (' + m.default_ratio + ' when the category matches no table row)\n        × (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')/100 × ' + m.growth_weight + ')      (7-day growth)\n        × (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ')/' + m.maturity_days + ' × ' + m.maturity_range + ')  (age with no token; unlisted counts as ' + m.unknown_age_days + ' days)\n        × (1 + min(chains, ' + m.spread_cap + ') × ' + m.spread_weight + ')                    (chain spread)'
      }),
      el('p', { text: 'The category ratio is what one dollar of TVL earns in that business — trading fees, an interest spread, a staking commission — so a perp venue\'s TVL carries more launch value than a bridge\'s. Age credits how long the protocol has run with no token, capped at four years so a decade-old name does not dominate. The page re-derives each row on screen, so any figure here can be checked against board.json.' }),
      el('table', { class: 'ratio-table' },
        el('thead', null, el('tr', null, el('th', { text: 'Category match' }), el('th', { text: 'Ratio' }), el('th', { text: 'What the token would earn' }))),
        el('tbody', null, ratios)
      )
    );
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var re = impliedOf(row);
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    dialog.appendChild(el('div', { class: 'd-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' · on the watchlist' : ' · early radar, below the floor') }),
        el('h2', { text: row.name }),
        el('span', { class: 'sub', text: (row.category || 'Other') + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + (row.listed_at ? ' · tracked since ' + row.listed_at : ' · no listing date') })
      ),
      el('button', { class: 'd-close', type: 'button', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var body = el('div', { class: 'd-body' });
    body.appendChild(el('section', null,
      el('h3', { text: 'Implied value — model ' + DATA.model_version }),
      el('div', { class: 'eq' },
        eqCell('TVL', fmtUsd(row.tvl_usd), ''),
        eqCell('Category ratio', '×' + row.category_ratio, row.category_note),
        eqCell('7-day growth', '×' + row.growth_multiplier, (growth === 0 ? 'no reported change' : fmtPct(row.change_7d) + ' clamped')),
        eqCell('Age with no token', '×' + row.maturity_multiplier, fmtAge(row.age_days)),
        eqCell('Chain spread', '×' + row.spread_multiplier, (row.chains || []).length + ' live chains'),
        eqCell('Implied value', fmtUsd(row.implied_value_usd), 'a model, not a price')
      ),
      el('div', { class: 'chain-eq', text:
        fmtUsd(row.tvl_usd) + ' × ' + row.category_ratio + ' × ' + row.growth_multiplier + ' × ' + row.maturity_multiplier + ' × ' + row.spread_multiplier +
        ' = ' + fmtUsd(row.implied_value_usd) + '   (page re-derives ' + fmtUsd(re) + (re === row.implied_value_usd ? ', the same number board.json carries' : ', which differs from the board — the data would be stale') + ')'
      })
    ));
    body.appendChild(el('section', null,
      el('h3', { text: 'Farm plan — how to be on the books before a launch' }),
      el('ol', { class: 'steps' }, (row.farm_steps || []).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    body.appendChild(el('p', { class: 'd-note', text: 'Implied value asks what a token would be worth if the protocol\'s record stayed as it is — it does not predict whether or when a token is issued. A protocol that records no token may still have one its record does not carry; check before you farm.' }));
    dialog.appendChild(body);
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }
  function eqCell(label, value, note) {
    return el('div', { class: label === 'Implied value' ? 'total' : '' },
      el('span', { text: label }), el('b', { text: value }), note ? el('span', { class: 'sub', text: note }) : null);
  }

  function render() {
    app.textContent = '';
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(masthead());
    wrap.appendChild(hero());
    wrap.appendChild(controls());
    wrap.appendChild(boardTable());
    wrap.appendChild(modelPanel());
    app.appendChild(wrap);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) { state.selected = null; dialog.close(); } });
})();

/* Archimedes World 3D 0.2.0 — deterministic, fixed-step volumetric laboratory. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Archimedes3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.2.0', DT = 0.1, SIZE = [24, 10, 18], GRID = [16, 6, 12];
  const CELLS = GRID.reduce((a, b) => a * b), EPS = 1e-9, RADIUS = 0.32;
  const ACTIONS = ['survey', 'anchor', 'exchange', 'recharge'];
  const GOALS = ['balance', 'discovery', 'resilience'];
  const NAMES = ['ADA', 'NOETHER', 'HYPATIA'];
  const DEFAULTS = {coupling: 0.8, learning: 1.8, diffusion: 0.65, noise: 0.025, sensorEvery: 5};
  const STATIONS = [
    {id: 'source', name: 'Source', p: [3.5, 2, 9]},
    {id: 'relay', name: 'Relay', p: [12, 4.5, 9]},
    {id: 'archive', name: 'Archive', p: [20.5, 7.5, 9]}
  ];
  const OBSTACLES = [
    {id: 'habitat', min: [7, 0, 3], max: [10, 3.2, 6]},
    {id: 'observatory', min: [15.5, 0, 12], max: [18.5, 5, 15]}
  ];
  const WEIGHTS = {balance: [1, 0.45, 3, 0.3, 0.07], discovery: [0.45, 0.2, 8, 0.2, 0.10], resilience: [2.4, 0.65, 0.8, 0.6, 0.03]};
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const norm = v => Math.hypot(...v), sub = (a, b) => a.map((n, i) => n - b[i]);
  const clone = x => JSON.parse(JSON.stringify(x));
  const assert = (v, message) => { if (!v) throw new Error(message); };
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  const checksum = x => hash(JSON.stringify(x)).toString(16).padStart(8, '0');
  function random(w) { let x = w.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; w.rng = x >>> 0; return w.rng / 4294967296; }
  const index = (x, y, z) => (y * GRID[2] + z) * GRID[0] + x;
  const cellPosition = (x, y, z) => [x, y, z].map((n, i) => (n + 0.5) * SIZE[i] / GRID[i]);
  function cell(p) { const c = p.map((v, i) => clamp(Math.floor(v * GRID[i] / SIZE[i]), 0, GRID[i] - 1)); return index(...c); }
  const sample = (w, p) => w.field[cell(p)];
  const features = (w, a) => [...a.p.map((n, i) => n / SIZE[i]), a.energy, sample(w, a.p)];
  function parameters(overrides = {}) {
    assert(overrides && typeof overrides === 'object' && !Array.isArray(overrides), 'Parameters must be an object.');
    const p = {...DEFAULTS}, limits = {coupling: [0, 2], learning: [0.1, 5], diffusion: [0, 1], noise: [0, 0.15], sensorEvery: [1, 20]};
    for (const [k, v] of Object.entries(overrides)) {
      assert(limits[k] && Number.isFinite(v) && v >= limits[k][0] && v <= limits[k][1], `Invalid parameter: ${k}`);
      if (k === 'sensorEvery') assert(Number.isInteger(v), 'Sensor interval must be an integer.');
      p[k] = v;
    }
    return p;
  }
  function log(w, kind, text) { w.events.push({tick: w.tick, kind, text}); if (w.events.length > 48) w.events.shift(); }
  function createWorld(seed = 'ARCHIMEDES-3D-001', overrides = {}) {
    assert(typeof seed === 'string' && seed.length > 0 && seed.length <= 80, 'Seed must contain 1–80 characters.');
    const w = {version: VERSION, seed, rng: hash(seed) || 1, tick: 0, params: parameters(overrides),
      action: 'survey', goal: 'balance', sourceOn: true, blackout: 0, field: [], visited: Array(CELLS).fill(0),
      agents: [], probes: [], nextProbe: 1, events: [], traces: [], collisions: 0, fieldClips: 0};
    for (let y = 0; y < GRID[1]; y++) for (let z = 0; z < GRID[2]; z++) for (let x = 0; x < GRID[0]; x++) {
      w.field.push(0.08 + 0.55 * Math.exp(-(norm(sub(cellPosition(x, y, z), STATIONS[0].p)) ** 2) / 20));
    }
    NAMES.forEach((name, id) => {
      const a = {id, name, p: [4.8 + id * 0.5, 2 + id * 1.8, 5.5 + id * 3 + (random(w) - 0.5) * 0.3], v: [0, 0, 0],
        energy: 0.82, m: [], previous: [], sensed: 0, lastSeen: 0, C: 1, D: 0, R: 0, phi: 0.8, I: 0, residual: 0, trail: []};
      a.m = features(w, a); a.previous = a.m.slice(); a.sensed = a.m[4]; w.agents.push(a); w.visited[cell(a.p)] = 1;
    });
    log(w, 'origin', 'Station initialized. Three agents; three spatial dimensions.');
    w.traces.push(metrics(w)); return w;
  }
  function target(w, a) {
    if (a.energy < 0.22 || w.action === 'recharge') return [3.5, 1.5 + a.id * 0.7, 8 + a.id];
    if (w.action === 'anchor') return STATIONS[a.id].p.slice();
    if (w.action === 'exchange') return STATIONS[(a.id + 1 + Math.floor(w.tick / 220)) % 3].p.slice();
    const points = [[21, 2, 3], [21, 8, 15], [4, 6, 15], [4, 2, 3], [12, 8, 4], [12, 6.5, 14]];
    return points[(Math.floor(w.tick / 160) + a.id * 2) % points.length].slice();
  }
  function updateField(w) {
    const next = Array(CELLS), spacing = SIZE.map((s, i) => s / GRID[i]);
    for (let y = 0; y < GRID[1]; y++) for (let z = 0; z < GRID[2]; z++) for (let x = 0; x < GRID[0]; x++) {
      const j = index(x, y, z), u = w.field[j];
      const lap = (w.field[index(Math.max(0, x - 1), y, z)] + w.field[index(Math.min(GRID[0] - 1, x + 1), y, z)] - 2 * u) / spacing[0] ** 2
        + (w.field[index(x, Math.max(0, y - 1), z)] + w.field[index(x, Math.min(GRID[1] - 1, y + 1), z)] - 2 * u) / spacing[1] ** 2
        + (w.field[index(x, y, Math.max(0, z - 1))] + w.field[index(x, y, Math.min(GRID[2] - 1, z + 1))] - 2 * u) / spacing[2] ** 2;
      const source = w.sourceOn ? 0.18 * Math.exp(-(norm(sub(cellPosition(x, y, z), STATIONS[0].p)) ** 2) / 7) : 0;
      const raw = u + DT * (w.params.diffusion * lap + source - 0.055 * u);
      next[j] = clamp(raw); if (next[j] !== raw) w.fieldClips++;
    }
    w.field = next;
  }
  function contact(p, box, radius) {
    const q = p.map((n, i) => clamp(n, box.min[i], box.max[i]));
    const d = sub(p, q), length = norm(d);
    if (length >= radius) return null;
    if (length > EPS) return {normal: d.map(n => n / length), penetration: radius - length};
    let best = Infinity, axis = 0, direction = -1;
    for (let i = 0; i < 3; i++) {
      if (p[i] - box.min[i] < best) { best = p[i] - box.min[i]; axis = i; direction = -1; }
      if (box.max[i] - p[i] < best) { best = box.max[i] - p[i]; axis = i; direction = 1; }
    }
    const normal = [0, 0, 0]; normal[axis] = direction;
    return {normal, penetration: radius + best};
  }
  function collide(w, body, radius, restitution) {
    for (let i = 0; i < 3; i++) {
      if (body.p[i] < radius || body.p[i] > SIZE[i] - radius) {
        const n = body.p[i] < radius ? 1 : -1;
        body.p[i] = clamp(body.p[i], radius, SIZE[i] - radius);
        if (body.v[i] * n < 0) body.v[i] *= -restitution;
        w.collisions++;
      }
    }
    for (const box of OBSTACLES) {
      const c = contact(body.p, box, radius); if (!c) continue;
      body.p = body.p.map((v, i) => v + c.normal[i] * (c.penetration + 1e-8));
      const vn = body.v.reduce((s, v, i) => s + v * c.normal[i], 0);
      if (vn < 0) body.v = body.v.map((v, i) => v - (1 + restitution) * vn * c.normal[i]);
      w.collisions++;
    }
  }
  function move(w, a) {
    const gap = sub(target(w, a), a.p), length = norm(gap), speed = 1.8 * clamp(a.energy / 0.3, 0.12, 1) * Math.min(1, length);
    let acc = a.p.map((p, i) => 2.2 * ((length > EPS ? speed * gap[i] / length : 0) - a.v[i]) + w.params.coupling * a.phi * (SIZE[i] * a.m[i] - p));
    for (const box of OBSTACLES) {
      const c = contact(a.p, box, RADIUS + 0.9);
      if (c) acc = acc.map((v, i) => v + 5 * c.penetration * c.normal[i]);
    }
    const an = norm(acc); if (an > 5) acc = acc.map(v => v * 5 / an);
    a.v = a.v.map((v, i) => v + DT * acc[i]);
    const vn = norm(a.v); if (vn > 2) a.v = a.v.map(v => v * 2 / vn);
    a.p = a.p.map((p, i) => p + DT * a.v[i]); collide(w, a, RADIUS, 0);
    const charge = w.sourceOn && norm(sub(a.p, STATIONS[0].p)) < 2.6 ? 0.075 : 0;
    a.energy = clamp(a.energy + DT * (charge - 0.003 - 0.005 * norm(a.v) ** 2));
    a.trail.push(a.p.slice()); if (a.trail.length > 90) a.trail.shift(); w.visited[cell(a.p)] = 1;
  }
  function updateModel(w, a) {
    const x = features(w, a), old = a.m.slice();
    if (!w.blackout && w.tick % w.params.sensorEvery === 0) { a.sensed = clamp(x[4] + w.params.noise * (2 * random(w) - 1)); a.lastSeen = w.tick; }
    const observed = [...x.slice(0, 4), a.sensed], gain = 1 - Math.exp(-w.params.learning * DT);
    a.m = old.map((v, i) => v + gain * (observed[i] - v));
    const dm = a.m.map((v, i) => (v - old[i]) / DT), dx = x.map((v, i) => (v - a.previous[i]) / DT);
    const gap = sub(x, a.m), delta = sub(dx, dm), g = [old[0] - x[0], old[1] - x[1], old[2] - x[2], 0, 0];
    a.R = g.reduce((s, v, i) => s + v * dm[i], 0) / (norm(g) * norm(dm) + EPS);
    a.residual = norm(gap) ** 2 + 0.02 * norm(delta) ** 2; a.D = a.residual - 0.06 * a.R;
    a.C = clamp(1 - norm(gap) / (norm(x) + norm(a.m) + EPS));
    a.phi = clamp(a.phi + DT / 2 * (0.9 * a.phi - 0.9 * a.phi ** 3 - 1.5 * a.phi * norm(gap) ** 2 - 0.02 * a.phi * norm(delta) ** 2 + 0.1 * a.R), 0, 1.5);
    a.I += DT * a.C; a.previous = x;
  }
  function metrics(w) {
    const mean = key => w.agents.reduce((s, a) => s + a[key], 0) / w.agents.length;
    const m = {tick: w.tick, time: w.tick * DT, C: mean('C'), D: mean('D'), phi: mean('phi'), energy: mean('energy'), coverage: w.visited.reduce((a, b) => a + b) / CELLS};
    m.regime = m.energy < 0.25 ? 'depleted' : w.blackout ? 'occluded' : m.C < 0.92 ? 'divergent' : 'tracking';
    return m;
  }
  function step(input, ticks = 1) {
    assert(Number.isInteger(ticks) && ticks >= 0 && ticks <= 10000, 'Ticks must be an integer from 0 to 10000.');
    const w = clone(input);
    for (let t = 0; t < ticks; t++) {
      w.tick++; updateField(w);
      for (const a of w.agents) { move(w, a); updateModel(w, a); }
      for (const b of w.probes) {
        b.v[1] -= 9.81 * DT; b.v = b.v.map(v => v * 0.995); b.p = b.p.map((p, i) => p + DT * b.v[i]);
        collide(w, b, 0.25, 0.55);
        if (b.p[1] <= 0.251 && Math.abs(b.v[1]) < 0.6) b.v[1] = 0;
      }
      if (w.blackout) w.blackout--;
      if (w.tick % 5 === 0) { w.traces.push(metrics(w)); if (w.traces.length > 120) w.traces.shift(); }
    }
    return w;
  }
  function setAction(input, action) { assert(ACTIONS.includes(action), 'Unknown intention.'); const w = clone(input); w.action = action; log(w, 'intention', `Intention: ${action}.`); return w; }
  function setGoal(input, goal) { assert(GOALS.includes(goal), 'Unknown objective.'); const w = clone(input); w.goal = goal; return w; }
  function setParameters(input, values) { const w = clone(input); w.params = parameters({...w.params, ...values}); return w; }
  function intervene(input, kind) {
    assert(['pulse', 'blackout', 'source', 'reset-model', 'probe', 'clear-probes'].includes(kind), 'Unknown intervention.');
    const w = clone(input);
    if (kind === 'pulse') for (let y = 0; y < GRID[1]; y++) for (let z = 0; z < GRID[2]; z++) for (let x = 0; x < GRID[0]; x++) {
      const j = index(x, y, z); w.field[j] = clamp(w.field[j] + 0.75 * Math.exp(-(norm(sub(cellPosition(x, y, z), STATIONS[1].p)) ** 2) / 12));
    }
    if (kind === 'blackout') w.blackout = 80;
    if (kind === 'source') w.sourceOn = !w.sourceOn;
    if (kind === 'reset-model') for (const a of w.agents) a.m = [0.5, 0.5, 0.5, 0.5, 0.5];
    if (kind === 'probe') {
      assert(w.probes.length < 24, '24 probes are already present. Clear probes before adding more.');
      w.probes.push({id: w.nextProbe++, p: [11 + random(w) * 2, 9, 8 + random(w) * 2], v: [(random(w) - 0.5) * 3, 0, (random(w) - 0.5) * 3]});
    }
    if (kind === 'clear-probes') w.probes = [];
    log(w, 'intervention', {pulse: 'Volumetric field pulse at relay.', blackout: 'Field sensors occluded for 8 seconds.', source: `Source ${w.sourceOn ? 'enabled' : 'disabled'}.`, 'reset-model': 'Agent estimates reset.', probe: 'Gravity probe released.', 'clear-probes': 'Gravity probes cleared.'}[kind]);
    return w;
  }
  function plan(input, options = {}) {
    const depth = options.depth ?? 3, width = options.width ?? 3, horizon = options.horizon ?? 20;
    assert(Number.isInteger(depth) && depth >= 1 && depth <= 4, 'Depth must be 1–4.');
    assert(Number.isInteger(width) && width >= 1 && width <= 4, 'Width must be 1–4.');
    assert(Number.isInteger(horizon) && horizon >= 1 && horizon <= 40, 'Horizon must be 1–40.');
    const origin = metrics(input).coverage, nodes = [];
    let beam = [{world: clone(input), sequence: [], score: 0, path: [], trails: input.agents.map(a => [a.p.slice()])}];
    for (let level = 0; level < depth; level++) {
      const candidates = [];
      for (const parent of beam) for (const action of ACTIONS) {
        const w = step(setAction(parent.world, action), horizon), m = metrics(w), weight = WEIGHTS[w.goal];
        const utility = weight[0] * m.energy + weight[1] * m.C + weight[2] * (m.coverage - origin) - weight[3] * Math.max(0, m.D) - weight[4] * Number(action === parent.world.action);
        const score = parent.score + 0.9 ** level * utility, id = nodes.length + 1;
        const node = {id, parent: parent.path.at(-1) ?? 0, level: level + 1, action, score, metrics: m};
        nodes.push(node);
        candidates.push({world: w, sequence: [...parent.sequence, action], score, path: [...parent.path, id],
          trails: parent.trails.map((tr, i) => [...tr, ...w.agents[i].trail.slice(-horizon)])});
      }
      candidates.sort((a, b) => b.score - a.score || a.path.at(-1) - b.path.at(-1)); beam = candidates.slice(0, width);
    }
    return {origin: checksum(input), originTick: input.tick, evaluated: nodes.length, simulatedTicks: nodes.length * horizon,
      depth, width, horizon, nodes, candidates: beam.map(b => ({sequence: b.sequence, score: b.score, metrics: metrics(b.world), trails: b.trails}))};
  }
  function counterfactual(input, ticks = 60) {
    assert(Number.isInteger(ticks) && ticks > 0 && ticks <= 100, 'Counterfactual ticks must be 1–100.');
    const factual = step(input, ticks), alternate = step(intervene(input, 'source'), ticks);
    return {origin: checksum(input), ticks, factual: metrics(factual), alternate: metrics(alternate),
      trails: alternate.agents.map(a => a.trail.slice(-ticks)), sourceOn: alternate.sourceOn};
  }
  function createSession(seed, p) { const world = createWorld(seed, p); return {world, cursor: 0, nextId: 1, history: [{id: 0, parent: null, label: 'Origin', world: clone(world)}]}; }
  function checkpoint(session, label = 'Checkpoint') {
    assert(typeof label === 'string' && label.length > 0 && label.length <= 100, 'Checkpoint label must contain 1–100 characters.');
    const s = clone(session), id = s.nextId++; s.history.push({id, parent: s.cursor, label, world: clone(s.world)}); s.cursor = id;
    if (s.history.length > 32) { s.history.shift(); const ids = new Set(s.history.map(n => n.id)); for (const n of s.history) if (!ids.has(n.parent)) n.parent = null; }
    return s;
  }
  function restore(session, id) { const s = clone(session), n = s.history.find(n => n.id === id); assert(n, 'Checkpoint not found.'); s.world = clone(n.world); s.cursor = id; return s; }
  function validateWorld(w) {
    const num = (n, a, b, name) => assert(Number.isFinite(n) && n >= a && n <= b, `Invalid ${name}.`);
    const vec = (v, length, a, b, name) => { assert(Array.isArray(v) && v.length === length, `Invalid ${name}.`); v.forEach(n => num(n, a, b, name)); };
    const integer = (n, a, b, name) => { num(n, a, b, name); assert(Number.isInteger(n), `Invalid ${name}.`); };
    const position = (p, radius) => { vec(p, 3, 0, 24, 'position'); p.forEach((n, i) => num(n, radius, SIZE[i] - radius, 'position')); for (const b of OBSTACLES) { const c = contact(p, b, radius); assert(!c || c.penetration < 1e-7, 'Body inside solid geometry.'); } };
    assert(w && w.version === VERSION, 'Unsupported 3D world version.');
    assert(typeof w.seed === 'string' && w.seed.length > 0 && w.seed.length <= 80, 'Invalid seed.');
    integer(w.tick, 0, 1e9, 'tick'); integer(w.rng, 1, 4294967295, 'random state');
    assert(w.params && Object.keys(w.params).sort().join() === Object.keys(DEFAULTS).sort().join(), 'Incomplete parameters.'); parameters(w.params);
    assert(ACTIONS.includes(w.action) && GOALS.includes(w.goal), 'Invalid action or objective.');
    assert(typeof w.sourceOn === 'boolean', 'Invalid source state.'); integer(w.blackout, 0, 80, 'blackout');
    vec(w.field, CELLS, 0, 1, 'field'); vec(w.visited, CELLS, 0, 1, 'visited'); assert(w.visited.every(v => v === 0 || v === 1), 'Invalid coverage.');
    assert(Array.isArray(w.agents) && w.agents.length === 3, 'Three agents required.');
    w.agents.forEach((a, i) => {
      assert(a.id === i && a.name === NAMES[i], 'Invalid agent identity.'); position(a.p, RADIUS); vec(a.v, 3, -2, 2, 'velocity');
      assert(norm(a.v) <= 2 + 1e-7, 'Excess agent speed.');
      for (const k of ['energy', 'C', 'sensed']) num(a[k], 0, 1, k);
      for (const k of ['m', 'previous']) vec(a[k], 5, 0, 1, k);
      num(a.phi, 0, 1.5, 'phi'); num(a.D, -1, 100, 'D'); num(a.R, -1, 1, 'R'); num(a.I, 0, 1e9, 'I'); num(a.residual, 0, 100, 'residual'); integer(a.lastSeen, 0, w.tick, 'observation tick');
      assert(Array.isArray(a.trail) && a.trail.length <= 90, 'Invalid trail.'); a.trail.forEach(p => { vec(p, 3, 0, 24, 'trail'); p.forEach((n, j) => num(n, 0, SIZE[j], 'trail')); });
    });
    assert(Array.isArray(w.probes) && w.probes.length <= 24, 'Invalid probes.'); integer(w.nextProbe, 1, 1e9, 'probe sequence');
    const ids = new Set(); for (const b of w.probes) { integer(b.id, 1, w.nextProbe - 1, 'probe id'); assert(!ids.has(b.id), 'Duplicate probe id.'); ids.add(b.id); position(b.p, 0.25); vec(b.v, 3, -40, 40, 'probe velocity'); }
    integer(w.collisions, 0, 1e12, 'collisions'); integer(w.fieldClips, 0, 1e12, 'field clips');
    assert(Array.isArray(w.events) && w.events.length <= 48, 'Invalid events.');
    for (const e of w.events) { integer(e.tick, 0, w.tick, 'event tick'); assert(typeof e.kind === 'string' && e.kind.length <= 40 && typeof e.text === 'string' && e.text.length <= 240, 'Invalid event.'); }
    assert(Array.isArray(w.traces) && w.traces.length <= 120, 'Invalid traces.');
    for (const t of w.traces) { integer(t.tick, 0, w.tick, 'trace tick'); num(t.time, 0, w.tick * DT, 'trace time'); for (const k of ['C', 'energy', 'coverage']) num(t[k], 0, 1, k); num(t.D, -1, 100, 'trace D'); num(t.phi, 0, 1.5, 'trace phi'); assert(['depleted', 'occluded', 'divergent', 'tracking'].includes(t.regime), 'Invalid regime.'); }
    return true;
  }
  function exportSession(s) { return JSON.stringify({format: 'archimedes-world3d', version: VERSION, session: s}); }
  function importSession(text) {
    assert(typeof text === 'string' && text.length <= 12_000_000, 'Import exceeds 12 MB.'); const data = JSON.parse(text);
    function inspect(v, depth = 0) {
      assert(depth < 20, 'Excessive nesting.');
      if (typeof v === 'number') assert(Number.isFinite(v), 'Non-finite number.');
      else if (typeof v === 'string') assert(v.length <= 1000, 'Oversized string.');
      else if (Array.isArray(v)) { assert(v.length <= 1200, 'Oversized array.'); v.forEach(x => inspect(x, depth + 1)); }
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { assert(!['__proto__', 'prototype', 'constructor'].includes(k), 'Forbidden property.'); inspect(x, depth + 1); }
      else assert(v === null || typeof v === 'boolean', 'Unsupported value.');
    }
    inspect(data); assert(data.format === 'archimedes-world3d' && data.version === VERSION, 'Use a 3D v0.2.0 session. Legacy 2D sessions use the original laboratory.');
    const s = data.session; assert(s && Array.isArray(s.history) && s.history.length > 0 && s.history.length <= 32, 'Invalid history.'); validateWorld(s.world);
    const ids = new Set(); for (const n of s.history) { assert(Number.isInteger(n.id) && n.id >= 0 && !ids.has(n.id), 'Invalid checkpoint id.'); assert(n.parent === null || ids.has(n.parent), 'Invalid history parent.'); assert(typeof n.label === 'string' && n.label.length > 0 && n.label.length <= 100, 'Invalid label.'); validateWorld(n.world); ids.add(n.id); }
    assert(ids.has(s.cursor) && Number.isInteger(s.nextId) && s.nextId > Math.max(...ids), 'Invalid history cursor.'); return clone(s);
  }
  return {VERSION, DT, SIZE, GRID, CELLS, RADIUS, ACTIONS, GOALS, NAMES, DEFAULTS, STATIONS, OBSTACLES, WEIGHTS,
    clone, checksum, cell, cellPosition, index, sample, parameters, createWorld, createSession, target, metrics, step, setAction, setGoal, setParameters,
    intervene, plan, counterfactual, checkpoint, restore, validateWorld, exportSession, importSession, contact};
});

# Archimedes World 3D — mathematical contract v0.2.0

Date: September 30, 2026. This document specifies `engine3d.js`. The original 2D contract remains in `docs/MATHEMATICS.md`.

## 1. State and units

The box has dimensions $L=(24,10,18)$ in simulation length units, with $y$ vertical. There are $N=(16,6,12)$ cell centers and $1152$ scalar samples. Spacing is $h_i=L_i/N_i$. The fixed step is $\Delta t=0.1$ simulation seconds. No conversion to measured laboratory units is calibrated.

World state contains tick, seed, xorshift32 PRNG state, parameters, intention, objective, source flag, blackout count, field, binary visited volume, three agents, gravity probes, bounded traces/events and contact counters. Every variable affecting continuation is serialized. Camera pose and display choices are presentation state and are not serialized.

Each agent has $p,v\in\mathbb R^3$, reserve $e\in[0,1]$, model $m\in[0,1]^5$, previous features, held field observation and observation tick, $C,D,R,\Phi,I$, residual and bounded position trail. Its normalized feature vector is

$$x=(p_x/24,\ p_y/10,\ p_z/18,\ e,\ u(p)).$$

Field lookup uses the containing cell, clamped at the boundary. Grid indexing is $j=(yN_z+z)N_x+x$.

## 2. Volumetric scalar update

For cell $j$,

$$u_j^{n+1}=\Pi_{[0,1]}\left[u_j^n+\Delta t\left(\kappa\sum_{i=1}^{3}\frac{u_{j+i}^n-2u_j^n+u_{j-i}^n}{h_i^2}+s_j-0.055u_j^n\right)\right].$$

Missing neighbors repeat the boundary cell, implementing zero normal flux. All updates read the prior field. With the source on,

$$s_j=0.18\exp(-\|p_j-(3.5,2,9)\|^2/7);$$

otherwise $s_j=0$. Initial field is $0.08+0.55\exp(-\|p_j-(3.5,2,9)\|^2/20)$. A pulse adds $0.75\exp(-\|p_j-(12,4.5,9)\|^2/12)$ and clips to $[0,1]$.

For $\kappa\le1$, $2\Delta t\kappa\sum_i h_i^{-2}+0.055\Delta t\approx0.2553<1$. Thus the source-free stencil has nonnegative weights with the declared decay. Summing it cancels diffusion fluxes across the outer reflecting boundary. Source and projection can change total field. Solid buildings do not alter the field stencil; this is not an impermeable-wall field model, a fluid solver or the canonical EFMW wave equation.

## 3. Agent movement and contacts

Intentions are survey, anchor, exchange and recharge. Survey uses six deterministic 3D waypoints phased by simulation tick. Anchor assigns agents to source, relay and archive; exchange cycles station targets every 220 ticks. Reserve below 0.22 forces a recharge target. Policies observe their own reserve; they do not perform general learned reasoning.

Let $d=t-p$. Desired speed is $1.8\,\mathrm{clamp}(e/0.3,0.12,1)\min(1,\|d\|)$. Desired velocity points along $d$, or is zero at the target. Acceleration before limiting is

$$a=2.2(v_* -v)+\lambda\Phi(L\odot m_{1:3}-p)+a_{avoid}.$$

Obstacle avoidance uses the sphere/AABB contact normal and $5$ times penetration into an expanded box neighborhood of radius $0.32+0.9$. Acceleration magnitude is capped at 5 and speed at 2:

$$v^{n+1}=\mathrm{cap}_2(v^n+\Delta t\,\mathrm{cap}_5(a)),\qquad p^{n+1}=p^n+\Delta t v^{n+1}.$$

Boundary and building overlaps are projected out for sphere radius 0.32. Inward normal velocity is removed. For centers inside a building, the closest face supplies a separating normal. The two solid axis-aligned boxes are $[7,0,3]$–$[10,3.2,6]$ and $[15.5,0,12]$–$[18.5,5,15]$.

Agent reserve changes as

$$e^{n+1}=\Pi_{[0,1]}[e^n+\Delta t(q-0.003-0.005\|v^{n+1}\|^2)],$$

where $q=0.075$ within 2.6 units of an enabled source, otherwise zero. These are illustrative rates, not physiological or hardware measurements. Flying agents use an effective control law with gravity already compensated; reserve is a simplified scalar and does not account for every physical work term.

## 4. Observations, estimates and feedback

Every fifth tick by default, unless the blackout counter is nonzero, held field observation becomes $\Pi_{[0,1]}(u(p)+\sigma(2r-1))$, where $r$ is the next seeded PRNG value. A blackout lasts 80 ticks. Position and reserve observations remain available. The observation vector is $y=(x_1,x_2,x_3,x_4,\tilde u)$.

With $g=1-e^{-\alpha\Delta t}$,

$$m^{n+1}=m^n+g(y-m^n),\quad \dot m=(m^{n+1}-m^n)/\Delta t,\quad \dot x=(x-x_{previous})/\Delta t.$$

Let $\epsilon=x-m^{n+1}$, $\delta=\dot x-\dot m$, $q=(m^n_1-x_1,m^n_2-x_2,m^n_3-x_3,0,0)$ and $\varepsilon=10^{-9}$. The locally defined alignment surrogate is

$$R=\frac{q\cdot\dot m}{\|q\|\|\dot m\|+\varepsilon},\quad D_+=\|\epsilon\|^2+0.02\|\delta\|^2,\quad D=D_+-0.06R.$$

$$C=\Pi_{[0,1]}\left(1-\frac{\|\epsilon\|}{\|x\|+\|m^{n+1}\|+\varepsilon}\right).$$

$$\Phi^{n+1}=\Pi_{[0,1.5]}\left[\Phi^n+\frac{\Delta t}{2}(0.9\Phi^n-0.9(\Phi^n)^3-1.5\Phi^n\|\epsilon\|^2-0.02\Phi^n\|\delta\|^2+0.1R)\right].$$

$$I^{n+1}=I^n+\Delta t C.$$

$I$ accumulates simulated coherence-time. It is not authentication or a proof of identity. $R$ continues the documented v0.1 surrogate; it is not an unreviewed claim of equivalence to the ambiguous Jacobian expression in the historical source. $D$ is signed and may be negative.

## 5. Gravity probes

At most 24 independent probe spheres of radius 0.25 can be released. Release position and horizontal velocity use seeded draws; altitude starts at 9. Each tick subtracts $9.81\Delta t$ from vertical velocity, multiplies all velocity components by 0.995, and advances position with the resulting velocity. Contact projection uses restitution 0.55: for inward normal speed $v_n<0$, $v\leftarrow v-(1+0.55)v_n n$. Small floor rebounds below 0.6 speed are suppressed.

The 9.81 value is a chosen gravity constant in simulation units. This discrete contact model dissipates energy and is not a calibrated high-accuracy mechanics solver. It has no continuous collision detection, probe/probe interaction, probe/agent interaction, angular dynamics, frictional rigid-body stacking or backreaction on the field.

## 6. Recursive search and counterfactuals

The planner clones the full world, expands four intentions, simulates each for $h$ ticks and retains the best $b$ candidates. It repeats to depth $d$. Its view is omniscient with respect to the simulated state; individual agents still have held/noisy field observations.

For metrics mean reserve $E$, mean coherence $C$, mean signed divergence $D$, and volume coverage $V$, stage utility is

$$U=w_E E+w_C C+w_V(V-V_0)-w_D\max(0,D)-w_R\mathbf1[a=a_{previous}].$$

| Objective | $w_E$ | $w_C$ | $w_V$ | $w_D$ | $w_R$ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Balance | 1 | 0.45 | 3 | 0.3 | 0.07 |
| Discovery | 0.45 | 0.2 | 8 | 0.2 | 0.10 |
| Resilience | 2.4 | 0.65 | 0.8 | 0.6 | 0.03 |

Scores sum $0.9^\ell U_\ell$ from level zero. These inherited, hand-selected weights express demo preferences, not calibrated human utility or optimality. Ties resolve by generation ID. The API bounds depth 1–4, width 1–4, and horizon 1–40 ticks. Evaluated branches total $4+4b(d-1)$; the default is 28 branches and 560 simulated ticks. Three full candidate sequences are shown; only the selected first intention is applied to the live world. Candidate paths are generated by actual rollouts, not drawn forecasts.

The counterfactual clones the same present twice and toggles the source in one clone, then simulates both 60 ticks by default. It reports their metrics and the alternative paths, leaving the original unchanged. It establishes a consequence inside the programmed model, not external causal evidence.

## 7. Update order, rendering and storage

Each tick: increment tick → update field → for each agent move then update estimate → advance/contact probes → decrement blackout → record metrics every fifth tick. This order is part of the model.

The UI accumulates wall time and advances fixed ticks; camera rendering never supplies randomness or modifies world dynamics. Long browser stalls are capped rather than replayed as an unbounded catch-up, and hidden documents pause. “1×” aims at ten ticks per wall second but can run slower on a constrained device. The field volume display places small glyphs at true cell centers, or shows one selected height layer. The buildings, agents and probes are perspective-projected 3D geometry with a depth buffer. Field glyph size/color, labels and camera controls are visualization choices.

Snapshots preserve world and PRNG state. Up to 32 checkpoints form a parent-linked DAG. Oldest-node pruning re-roots surviving children. Imports validate finite values, dimensions, bounded arrays, identities, body positions, parent order and format; the text limit is 12 MB. Invalid imports are rejected before replacing current state. Legacy 2D saves are deliberately not interpreted as 3D saves. FNV-based checksums are replay labels, not cryptographic authentication.

## 8. Claims and remaining work

This implements the equations and rules above and tests selected invariants. No full Monolithic 102/165 implementation, canonical Zoo pass, general-world simulator, consciousness/AGI claim, quantum gravity solver or human-life forecast follows from it. Future modules require explicit symbols, units, approximation choices, source-to-code mapping and separate validation.

Rendering uses the [Khronos WebGL 1.0 specification](https://registry.khronos.org/webgl/specs/1.0/) for canvas drawing, viewport sizing, depth testing and context recovery. No third-party rendering source is bundled.

# Formal coverage

## Frozen target

Source: [`world3d/MATHEMATICS.md`](../world3d/MATHEMATICS.md), baseline commit `1a6a138d95c4724a5affed6930351949e6bd77cf`.
The definitions and theorem hypotheses in `World3D.lean` are the acceptance target.
The pinned Lean/Mathlib build and strict axiom audit must pass before treating a
statement as machine-checked. The workflow records the exact tested commit/run.

## Statements covered

The anisotropic six-neighbor coefficients for spacings 24/16, 10/6 and 18/12 are nonnegative; their sum is 0.9945; source-free steps preserve nonnegativity and have the stated uniform decay and upper bound. Normal restitution dissipates normal kinetic energy. The API maximum is 2080 rollout ticks.

## Limits and unresolved obligations

These are exact-arithmetic 3D stencil and contact statements. They do not establish full coupled-world convergence, continuous collision detection, complete state replay refinement, or an external physical model.

## Evidence discipline

These are established algebra, analysis and finite-dimensional mathematics,
not a novelty claim. Formal proofs establish only their stated hypotheses and
conclusions. Computational regression tests are software checks, not independent
experimental evidence. No theorem uses a claimed physical interpretation as a
premise. No custom axioms, `sorry`, or native-evaluation trust exception is allowed.
No new animal operation is invented or claimed to have been executed.

The first evidence status is **unresolved** until the exact-commit workflow
succeeds; thereafter only the covered formal statements are **demonstrated**.
Scientific applicability remains a **hypothesis/postulate** unless separately tested.

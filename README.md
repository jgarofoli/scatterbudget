# scatterbudget

**[Try it live](https://jgarofoli.github.io/scatterbudget/)**

A single-page tool that propagates uncertainty through a formula two ways at once — a closed-form delta method and a Monte Carlo scatter — and flags where they disagree.

## What it does

Enter a formula (e.g. `F = 0.5 * rho * v^2 * Cd * A`), give each input a nominal value and an uncertainty (σ), and scatterbudget:

- computes the propagated output uncertainty analytically via symbolic partial derivatives (the standard "delta method" from a GUM-style uncertainty budget), and shows a per-input contribution table;
- runs a Monte Carlo simulation from the same inputs and formula, and shows a scatter plot of the output against each input (with Pearson r) plus a histogram of the output distribution;
- compares the two resulting uncertainty estimates and flags when they diverge beyond a threshold — the signal that the formula is nonlinear (or its inputs interact) over the range the uncertainties span, and that a single "value ± σ" is misleading.

Everything runs client-side in the browser — no backend, no build step, one HTML file.

## Who it's for

Anyone who reports or reads a measurement as "value ± uncertainty" and wants to know whether that ± actually holds: engineers, scientists, and analysts doing back-of-envelope error propagation who want a quick check on whether their formula is linear enough, over their actual measurement uncertainties, for the standard linear approximation to be trustworthy.

## Why it exists

Delta-method uncertainty propagation and Monte Carlo sensitivity analysis are both well-established techniques on their own. The gap is a tool that runs both on the *same* formula and inputs and puts the disagreement front and center — because that disagreement, not either number alone, is what tells you whether to trust the formula's uncertainty estimate or the simulation's.

## License

[CC0 1.0 Universal](LICENSE) — public domain. Use it, fork it, ship it, no attribution required.

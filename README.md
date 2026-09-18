# scatterbudget

**[Try it live](https://jgarofoli.github.io/scatterbudget/)**

A single-page tool that propagates uncertainty through a formula two ways at once — a closed-form delta method and a Monte Carlo scatter — and flags where they disagree.

## What it does

Enter a formula (e.g. [`F = 0.5 * rho * v^2 * Cd * A`](https://jgarofoli.github.io/scatterbudget/#f=F+%3D+0.5+*+rho+*+v%5E2+*+Cd+*+A&v=A%3A2.2%3A0.05%2CCd%3A0.3%3A0.02%2Crho%3A1.225%3A0.02%2Cv%3A30%3A3&n=10000&t=15) &mdash; aerodynamic drag force, with realistic values and uncertainties already filled in), give each input a nominal value and an uncertainty (σ), and scatterbudget:

- computes the propagated output uncertainty analytically via symbolic partial derivatives (the standard "delta method" from a GUM-style uncertainty budget), and shows a per-input contribution table;
- runs a Monte Carlo simulation from the same inputs and formula, and shows a scatter plot of the output against each input (with Pearson r) plus a histogram of the output distribution;
- compares the two resulting uncertainty estimates and flags when they diverge beyond a threshold — the signal that the formula is nonlinear (or its inputs interact) over the range the uncertainties span, and that a single "value ± σ" is misleading.

Everything runs client-side in the browser — no backend, no build step, one HTML file.

## Who it's for

Anyone who reports or reads a measurement as "value ± uncertainty" and wants to know whether that ± actually holds: engineers, scientists, and analysts doing back-of-envelope error propagation who want a quick check on whether their formula is linear enough, over their actual measurement uncertainties, for the standard linear approximation to be trustworthy.

## Why it exists

Delta-method uncertainty propagation and Monte Carlo sensitivity analysis are both well-established techniques on their own. The gap is a tool that runs both on the *same* formula and inputs and puts the disagreement front and center — because that disagreement, not either number alone, is what tells you whether to trust the formula's uncertainty estimate or the simulation's.

For example, the [Stefan–Boltzmann law](https://en.wikipedia.org/wiki/Stefan%E2%80%93Boltzmann_law) `P = σ·A·T⁴` for radiative heat loss ([try it](https://jgarofoli.github.io/scatterbudget/#f=P+%3D+sb+*+A+*+T%5E4&v=A%3A2%3A0.1%2CT%3A800%3A160%2Csb%3A5.67e-8%3A0&n=10000&t=15) with a plausible ±20% uncertainty on a rough temperature measurement) — the delta method and the Monte Carlo simulation disagree on the output uncertainty by roughly 20%, because the T⁴ term is sharply nonlinear over that range. A linear "value ± σ" summary alone would hide that.

## Development

`docs/index.html` is the entire deployed page — no build step, no bundler, nothing else ships; GitHub Pages is configured to serve from the `docs/` folder specifically so that everything else in the repo (tests, `package.json`, dev tooling) stays out of the published site. The regression tests live at the repo root as dev-only tooling and never touch that file's dependencies:

```sh
npm install
npm test
```

This runs a [Playwright](https://playwright.dev/) suite (via Node's built-in test runner) covering parsing, both computation methods, the divergence flag, chart/table labeling, and the shareable-URL state — including a couple of regressions that shipped and got caught this way, like the URL silently resetting variable values on reload, and σ rendering as the wrong Greek letter (Σ) under the header's uppercase styling. The suite intercepts the CDN requests for math.js and Chart.js and serves vendored copies from `tests/fixtures/` instead, so it runs offline and doesn't depend on jsdelivr being reachable.

## License

[CC0 1.0 Universal](LICENSE) — public domain. Use it, fork it, ship it, no attribution required.

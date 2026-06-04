---
title: "What the Sharpe Ratio Actually Tells You"
date: "2024-01-15"
excerpt: "The Sharpe ratio is the most cited number in portfolio management — and the most misread. Here's what it measures, what it doesn't, and how to use it."
---

# What the Sharpe Ratio Actually Tells You

The Sharpe ratio is the most cited number in portfolio management — and probably the most misread. Fund brochures lead with it. Interview candidates recite it. But most people who quote it couldn't explain what a "unit of risk" actually is, or why a Sharpe of 1.2 might be worse than a Sharpe of 0.8 in certain contexts.

Let's fix that.

## The Formula

$$\text{Sharpe} = \frac{R_p - R_f}{\sigma_p}$$

Where:
- **R_p** = annualised portfolio return
- **R_f** = risk-free rate (e.g. the yield on 3-month T-bills, currently ~4.3%)
- **σ_p** = annualised standard deviation of returns

In plain English: **how much extra return are you earning per unit of volatility?**

The numerator is your *excess return* — what you earned beyond just parking money in T-bills. The denominator is your *total volatility*, up and down. Divide one by the other and you get a dimensionless score that lets you compare any two portfolios regardless of their size or absolute return.

## What "Good" Looks Like

| Sharpe | Interpretation |
|--------|---------------|
| < 0    | You're earning less than T-bills — take the free money instead |
| 0–0.5  | Marginal. You're compensated for risk but not well |
| 0.5–1  | Acceptable for most active strategies |
| 1–2    | Good. Hedge funds aim here |
| > 2    | Exceptional — or your return series has problems |

The S&P 500 historically runs around **0.5–0.6** over long periods. A well-diversified portfolio of stocks and bonds sits around **0.7–0.9**. Claiming a Sharpe above 2 in live trading deserves serious scrutiny.

## The Denominator Is the Trap

The biggest misuse of the Sharpe ratio is ignoring what's in the denominator.

Standard deviation treats *all* volatility equally — upside and downside. If your portfolio had a huge month up, that *reduces* your Sharpe, even though most investors are perfectly happy with unexpected gains.

This is why the **Sortino ratio** was invented: it replaces σ with *downside deviation* — the standard deviation of returns below your target. A portfolio with lots of upside volatility but limited downside will look much better on Sortino than Sharpe.

## What It Can't Tell You

**1. Absolute magnitudes.**
A Sharpe of 1.5 on a portfolio returning 5%/year is very different from a Sharpe of 1.5 on one returning 30%/year. The ratio tells you *efficiency*, not *magnitude*.

**2. Tail risk.**
Sharpe is a variance measure. It completely ignores the shape of the distribution's tails. A strategy that earns consistent 0.1%/day and then loses 30% in a single day can have a wonderful Sharpe ratio right up until the catastrophic loss. This is why risk managers also look at **VaR**, **CVaR**, and max drawdown.

**3. Autocorrelation.**
If a strategy's returns are serially correlated — common in illiquid assets or options strategies — standard deviation underestimates true risk, and the Sharpe ratio is inflated. Lo (2002) shows that monthly-rebalanced strategies can have their annualised Sharpe overstated by a factor of √12 if returns are not IID.

**4. The right benchmark.**
The risk-free rate you use matters. During low-rate environments (2010–2021, when rates were near zero), almost everything looked good on Sharpe because R_f ≈ 0. Now that T-bills yield ~4.3%, your hurdle is much higher.

## A Worked Example

Say your portfolio returned **12% annualised** with **18% volatility**, and the risk-free rate is **4.3%**.

```
Sharpe = (12% - 4.3%) / 18% = 7.7% / 18% = 0.43
```

That's below 0.5 — mediocre risk-adjusted performance, even though 12% sounds great in absolute terms. You're not being well-compensated for the volatility you're taking.

If you could reduce volatility to **10%** while keeping the same return:

```
Sharpe = 7.7% / 10% = 0.77
```

Much better — and you didn't need a higher return, just a better-constructed portfolio.

## Reading It on the Dashboard

On this dashboard, the Sharpe ratio is calculated from **daily returns annualised by ×252**. The risk-free rate is configurable in `holdings.json`. Hover over the metric for the exact formula used.

A Sharpe above 1.0 is highlighted in green. Below 0 is red. But don't anchor on those thresholds alone — read it alongside volatility, beta, and max drawdown to get the full picture.

## Further Reading

- Sharpe, W.F. (1966). "Mutual Fund Performance." *Journal of Business*, 39(1).
- Lo, A.W. (2002). "The Statistics of Sharpe Ratios." *Financial Analysts Journal*, 58(4).
- Israelsen, C.L. (2005). "A Refinement to the Sharpe Ratio and Information Ratio." *Journal of Asset Management*.

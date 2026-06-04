---
title: "Beta, Alpha, and Why Correlation Isn't Causation"
date: "2024-02-01"
excerpt: "Beta measures how your portfolio moves with the market. Alpha measures whether you're earning more than your beta deserves. Here's how to read both — and why R-squared matters more than most investors realize."
---

# Beta, Alpha, and Why Correlation Isn't Causation

Few concepts in finance are more invoked and less understood than alpha and beta. Let's be precise.

## Beta: Systematic Risk

Beta (β) measures how much your portfolio moves for every 1% the benchmark moves.

$$\beta = \frac{\text{Cov}(R_p, R_b)}{\text{Var}(R_b)}$$

Mechanically, it's the slope of an OLS regression of your daily excess returns on the benchmark's daily excess returns.

| Beta | Meaning |
|------|---------|
| 0    | Uncorrelated with market (e.g. T-bills) |
| 0.5  | Moves half as much as market |
| 1.0  | Moves with market (by definition, S&P 500 = 1.0) |
| 1.5  | 50% more volatile than market |
| −0.5 | Moves inversely to market |

**Important nuance:** beta is not the same as volatility. A portfolio of biotech stocks might have high absolute volatility but a beta of only 0.8 if those stocks happen to be uncorrelated with the S&P 500. Beta specifically captures *co-movement*, not standalone variance.

### What Beta Is Used For

Beta feeds into the **Capital Asset Pricing Model (CAPM)**, which says:

$$E[R_p] = R_f + \beta \cdot (E[R_m] - R_f)$$

This is the market's *compensation* for bearing systematic risk. A portfolio with β=1.5 should, according to CAPM, earn 1.5× the market's equity risk premium — not because you're skilled, but because you're taking more market risk.

## Jensen's Alpha: Are You Actually Adding Value?

Alpha (α) is the return you earn *above and beyond* what CAPM predicts for your beta:

$$\alpha = R_p - [R_f + \beta \cdot (R_m - R_f)]$$

If your portfolio returned 15%, T-bills yielded 4%, the market returned 10%, and your beta is 1.5:

```
Expected by CAPM = 4% + 1.5 × (10% − 4%) = 4% + 9% = 13%
Alpha = 15% − 13% = +2%
```

That extra 2% is your "alpha" — return that CAPM can't explain by market exposure alone. It might be skill, it might be luck, it might be taking on risk that beta doesn't capture (like liquidity risk or factor tilts).

**Negative alpha** means you're underperforming your fair compensation for risk. Most active fund managers have negative alpha after fees.

### Alpha is Annualised in Two Steps

In this dashboard, we run the regression on *daily* excess returns. The daily intercept (α_daily) is then annualised: `α_annual = α_daily × 252`. This gives you the expected annual outperformance.

## R-Squared: The Qualifier You're Missing

Here's what most investors skip: **R² tells you how much to trust the beta and alpha numbers**.

$$R^2 = \text{corr}(R_p, R_b)^2$$

R² is the fraction of your portfolio's variance that's explained by the benchmark.

| R² | Implication |
|----|-------------|
| 0.95 | Portfolio is essentially an index fund. Alpha/beta are meaningful. |
| 0.70 | Moderately benchmark-driven. Alpha is meaningful. |
| 0.30 | Mostly idiosyncratic. Your beta is nearly meaningless — you're not a benchmark tracker at all. |
| 0.05 | Effectively uncorrelated with benchmark. Beta ≈ useless. |

A concentrated 5-stock portfolio of small-caps may have R² of 0.25 vs SPY. Saying that portfolio has a "beta of 1.1 to SPY" is technically correct but practically meaningless — only 25% of its variance is explained by the S&P 500 at all.

## Why Correlation Isn't Causation

This is the conceptual trap that bites investors constantly.

Beta and correlation measure *co-movement*, not cause and effect. If your tech portfolio is highly correlated with SPY, it's not because SPY *causes* your portfolio to move — it's because both respond to the same underlying macro factors (interest rates, growth expectations, risk appetite).

During the 2022 rate-hike cycle, high-duration tech stocks and REITs were both crushed simultaneously. They're not in the same industry. Their correlation spiked because they shared a *common factor exposure* (duration/rate sensitivity) that wasn't visible from their historical correlation during low-rate environments.

**The lesson:** historical correlation is backward-looking. Risk models built on it can fail precisely when diversification is most needed — in a crisis, correlations tend to converge toward 1 as investors sell everything. This is called "correlation breakdown" and it's why true diversification requires thinking about *factor exposures*, not just pairwise correlation.

## Reading These Numbers on the Dashboard

- **Beta**: check it against R². If R² < 0.5, beta is noisy.
- **Alpha**: focus on whether it's positive *after* accounting for your tracking error. An alpha of +2% with a tracking error of 12% is not statistically significant.
- **Correlation matrix**: look for clusters. Tickers with correlation > 0.8 are behaving as a single risk position — you own concentration, not diversification.

## Further Reading

- Jensen, M.C. (1968). "The Performance of Mutual Funds in the Period 1945–1964." *Journal of Finance*.
- Black, F., Jensen, M.C., & Scholes, M. (1972). "The Capital Asset Pricing Model: Some Empirical Tests."
- Ang, A. (2014). *Asset Management: A Systematic Approach to Factor Investing*. Oxford University Press.

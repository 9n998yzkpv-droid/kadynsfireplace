"""
RIA-grade risk/return metrics — all formulas are documented inline.

Every public function receives a pd.Series of *daily* returns (decimal, e.g. 0.01 = 1%)
unless noted otherwise. Annualisation factor = 252 trading days.

References:
  - Sharpe (1966), "Mutual Fund Performance"
  - Sortino & van der Meer (1991)
  - Jensen (1968), "The Performance of Mutual Funds"
  - Treynor (1965)
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import NamedTuple

TRADING_DAYS = 252  # annualisation constant


# ── helpers ─────────────────────────────────────────────────────────────────

def _align(a: pd.Series, b: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Inner-join two return series on their date index."""
    combined = pd.concat([a, b], axis=1).dropna()
    return combined.iloc[:, 0], combined.iloc[:, 1]


def _validate(returns: pd.Series, min_obs: int = 5) -> bool:
    return len(returns.dropna()) >= min_obs


# ── position-level ───────────────────────────────────────────────────────────

def position_metrics(
    ticker: str,
    shares: float,
    cost_basis_per_share: float,
    latest_price: float,
    portfolio_cost_total: float,
    portfolio_value_total: float,
) -> dict:
    """
    Per-position summary.
    Weight = position value / total portfolio value.
    Unrealised P&L = (current price - cost basis) * shares.
    """
    cost = shares * cost_basis_per_share
    value = shares * latest_price
    gl_dollar = value - cost
    gl_pct = (gl_dollar / cost * 100) if cost > 0 else 0.0
    weight = (value / portfolio_value_total * 100) if portfolio_value_total > 0 else 0.0
    return {
        "ticker": ticker,
        "shares": shares,
        "latest_price": round(latest_price, 4),
        "cost_basis_per_share": round(cost_basis_per_share, 4),
        "cost_basis_total": round(cost, 2),
        "market_value": round(value, 2),
        "unrealized_gl_dollar": round(gl_dollar, 2),
        "unrealized_gl_pct": round(gl_pct, 2),
        "weight_pct": round(weight, 2),
    }


# ── annualised return / CAGR ─────────────────────────────────────────────────

def cagr(price_series: pd.Series) -> float:
    """
    CAGR = (ending_value / beginning_value) ^ (252 / n_days) - 1
    Measures the smoothed annual growth rate of a price series.
    """
    if len(price_series) < 2:
        return float("nan")
    n = len(price_series) - 1  # trading-day span
    ratio = price_series.iloc[-1] / price_series.iloc[0]
    if ratio <= 0:
        return float("nan")
    return float(ratio ** (TRADING_DAYS / n) - 1)


def annualised_return(daily_returns: pd.Series) -> float:
    """
    Annualised arithmetic return = mean(daily) × 252.
    Used in ratio numerators; CAGR is the 'truer' long-run figure.
    """
    if not _validate(daily_returns):
        return float("nan")
    return float(daily_returns.mean() * TRADING_DAYS)


# ── volatility ───────────────────────────────────────────────────────────────

def annualised_volatility(daily_returns: pd.Series) -> float:
    """
    σ_annual = std(daily_returns) × √252
    Standard deviation measures total dispersion of returns (up AND down).
    """
    if not _validate(daily_returns):
        return float("nan")
    return float(daily_returns.std(ddof=1) * np.sqrt(TRADING_DAYS))


# ── Sharpe ratio ─────────────────────────────────────────────────────────────

def sharpe_ratio(daily_returns: pd.Series, risk_free_annual: float) -> float:
    """
    Sharpe = (R_p - R_f) / σ_p   (all annualised)
    Measures excess return earned per unit of total risk.
    >1 is good; >2 is excellent; negative means underperforming T-bills.
    """
    if not _validate(daily_returns):
        return float("nan")
    daily_rf = risk_free_annual / TRADING_DAYS
    excess = daily_returns - daily_rf
    sigma = excess.std(ddof=1)
    if sigma == 0:
        return float("nan")
    return float((excess.mean() / sigma) * np.sqrt(TRADING_DAYS))


# ── Sortino ratio ────────────────────────────────────────────────────────────

def sortino_ratio(daily_returns: pd.Series, risk_free_annual: float) -> float:
    """
    Sortino = (R_p - R_f) / downside_deviation   (all annualised)
    Like Sharpe but only penalises *negative* volatility — upside variance
    is not 'risk' in the investor's sense.
    Downside deviation = √(mean of squared returns below MAR)).
    MAR (minimum acceptable return) = daily risk-free rate.
    """
    if not _validate(daily_returns):
        return float("nan")
    daily_rf = risk_free_annual / TRADING_DAYS
    excess = daily_returns - daily_rf
    downside = excess[excess < 0]
    if len(downside) == 0:
        return float("inf")
    downside_dev = np.sqrt((downside ** 2).mean()) * np.sqrt(TRADING_DAYS)
    ann_excess = excess.mean() * TRADING_DAYS
    if downside_dev == 0:
        return float("nan")
    return float(ann_excess / downside_dev)


# ── max drawdown ──────────────────────────────────────────────────────────────

def max_drawdown(price_series: pd.Series) -> dict:
    """
    Max Drawdown = (trough - peak) / peak  — the worst peak-to-valley decline.
    A drawdown of -0.30 means the portfolio fell 30% from its high.
    Returns the drawdown value and the peak/trough dates.
    """
    if len(price_series) < 2:
        return {"max_drawdown": float("nan"), "peak_date": None, "trough_date": None}

    cummax = price_series.cummax()
    drawdown = (price_series - cummax) / cummax

    trough_idx = drawdown.idxmin()
    trough_val = drawdown.min()

    # Peak is the cummax point BEFORE the trough
    peak_idx = price_series[:trough_idx].idxmax()

    return {
        "max_drawdown": round(float(trough_val), 4),
        "peak_date": str(peak_idx.date()) if hasattr(peak_idx, "date") else str(peak_idx),
        "trough_date": str(trough_idx.date()) if hasattr(trough_idx, "date") else str(trough_idx),
    }


# ── beta & alpha (CAPM) ──────────────────────────────────────────────────────

def beta_alpha(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
    risk_free_annual: float,
) -> dict:
    """
    Beta = Cov(R_p, R_b) / Var(R_b)
    Measures how much the portfolio moves per 1% move in the benchmark.
    Beta=1: moves with market; <1: less volatile; >1: more volatile.

    Jensen's Alpha = R_p - [R_f + β(R_b - R_f)]   (annualised)
    The return in excess of what CAPM predicts given the portfolio's beta.
    Positive alpha = genuine skill / edge above market compensation for risk.

    R-squared = corr(R_p, R_b)^2
    What fraction of portfolio variance is explained by benchmark moves.
    """
    port, bench = _align(portfolio_returns, benchmark_returns)
    if len(port) < 10:
        return {"beta": float("nan"), "alpha": float("nan"), "r_squared": float("nan"), "correlation": float("nan")}

    daily_rf = risk_free_annual / TRADING_DAYS

    # OLS regression: excess_port = α_daily + β * excess_bench
    excess_p = port - daily_rf
    excess_b = bench - daily_rf

    slope, intercept, r_value, _, _ = stats.linregress(excess_b, excess_p)

    beta = float(slope)
    alpha_ann = float(intercept * TRADING_DAYS)  # daily alpha → annual
    r_sq = float(r_value ** 2)
    corr = float(r_value)

    return {
        "beta": round(beta, 4),
        "alpha": round(alpha_ann, 4),
        "r_squared": round(r_sq, 4),
        "correlation": round(corr, 4),
    }


# ── Treynor ratio ────────────────────────────────────────────────────────────

def treynor_ratio(daily_returns: pd.Series, beta: float, risk_free_annual: float) -> float:
    """
    Treynor = (R_p - R_f) / β
    Like Sharpe but normalises by *systematic* (market) risk, not total risk.
    More meaningful for well-diversified portfolios where unsystematic risk is low.
    """
    if np.isnan(beta) or beta == 0:
        return float("nan")
    ann_ret = annualised_return(daily_returns)
    return float((ann_ret - risk_free_annual) / beta)


# ── tracking error & information ratio ──────────────────────────────────────

def tracking_error_ir(
    portfolio_returns: pd.Series, benchmark_returns: pd.Series
) -> dict:
    """
    Tracking Error (TE) = std(R_p - R_b) × √252
    Measures how closely the portfolio follows the benchmark.
    Low TE → index-like; high TE → active/concentrated.

    Information Ratio (IR) = (R_p - R_b) / TE   (annualised)
    Measures active return per unit of active risk.
    IR > 0.5 is considered good; > 1.0 is excellent.
    """
    port, bench = _align(portfolio_returns, benchmark_returns)
    if len(port) < 10:
        return {"tracking_error": float("nan"), "information_ratio": float("nan")}
    active = port - bench
    te = float(active.std(ddof=1) * np.sqrt(TRADING_DAYS))
    ir = float((active.mean() * TRADING_DAYS) / te) if te > 0 else float("nan")
    return {"tracking_error": round(te, 4), "information_ratio": round(ir, 4)}


# ── Value at Risk ─────────────────────────────────────────────────────────────

def value_at_risk(daily_returns: pd.Series, portfolio_value: float, confidence: float = 0.95) -> dict:
    """
    VaR answers: "What is the worst loss I should expect to NOT exceed
    with X% confidence over 1 trading day?"

    Historical VaR: sort actual daily returns, take the (1-confidence) percentile.
    No distribution assumption — uses the actual observed return distribution.

    Parametric VaR (variance-covariance): assumes normal distribution.
    VaR = -( μ - z * σ ) * portfolio_value
    where z = norm.ppf(1 - confidence).
    Faster / closed-form but assumes normality (underestimates fat tails).
    """
    if not _validate(daily_returns, 20):
        return {
            "var_historical_dollar": float("nan"),
            "var_parametric_dollar": float("nan"),
            "var_historical_pct": float("nan"),
            "var_parametric_pct": float("nan"),
        }

    alpha = 1 - confidence  # e.g. 0.05 for 95% VaR

    # Historical
    hist_pct = float(np.percentile(daily_returns.dropna(), alpha * 100))
    hist_dollar = abs(hist_pct * portfolio_value)

    # Parametric
    mu = daily_returns.mean()
    sigma = daily_returns.std(ddof=1)
    z = stats.norm.ppf(alpha)           # e.g. -1.645 for 5th percentile
    param_pct = float(mu + z * sigma)   # negative number = loss
    param_dollar = abs(param_pct * portfolio_value)

    return {
        "var_historical_pct": round(hist_pct * 100, 3),
        "var_historical_dollar": round(hist_dollar, 2),
        "var_parametric_pct": round(param_pct * 100, 3),
        "var_parametric_dollar": round(param_dollar, 2),
    }


# ── covariance & correlation matrices ────────────────────────────────────────

def covariance_matrix(returns_df: pd.DataFrame) -> dict:
    """
    Covariance matrix: Cov[i,j] = E[(R_i - μ_i)(R_j - μ_j)]
    Measures how pairs of assets move together in absolute terms.
    Annualised by multiplying by 252.

    Correlation matrix: Corr[i,j] = Cov[i,j] / (σ_i × σ_j)
    Normalises covariance to [-1, +1].
    +1 = perfectly co-move; 0 = independent; -1 = perfectly inverse.
    """
    cov = returns_df.cov() * TRADING_DAYS
    corr = returns_df.corr()
    return {
        "covariance": {
            col: {r: round(float(v), 6) for r, v in row.items()}
            for col, row in cov.to_dict().items()
        },
        "correlation": {
            col: {r: round(float(v), 4) for r, v in row.items()}
            for col, row in corr.to_dict().items()
        },
    }


# ── risk contribution ────────────────────────────────────────────────────────

def risk_contribution(weights: np.ndarray, cov_matrix: np.ndarray, tickers: list[str]) -> dict:
    """
    Marginal contribution to portfolio risk (% of total portfolio variance).

    Portfolio variance = w' Σ w
    Marginal contribution of asset i = (Σw)_i × w_i / (w'Σw)

    Tells you which positions are actually driving your risk budget —
    a 10% weight stock can contribute 40% of portfolio variance if it's volatile
    and correlated to other holdings.
    """
    port_var = float(weights @ cov_matrix @ weights)
    if port_var <= 0:
        return {t: float("nan") for t in tickers}
    marginal = cov_matrix @ weights
    contrib = (weights * marginal) / port_var
    return {t: round(float(c * 100), 2) for t, c in zip(tickers, contrib)}

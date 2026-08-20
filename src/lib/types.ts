export interface Position {
  ticker: string
  shares: number
  latest_price: number
  cost_basis_per_share: number
  cost_basis_total: number
  market_value: number
  unrealized_gl_dollar: number
  unrealized_gl_pct: number
  weight_pct: number
}

export interface PortfolioMetrics {
  total_value: number
  total_cost_basis: number
  total_return_dollar: number
  total_return_pct: number
  cagr: number
  annualised_return: number
  annualised_volatility: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  max_drawdown_peak_date: string
  max_drawdown_trough_date: string
  beta: number
  alpha: number
  r_squared: number
  correlation_to_benchmark: number
  treynor_ratio: number
  tracking_error: number
  information_ratio: number
  var_95_historical_dollar: number
  var_95_historical_pct: number
  var_95_parametric_dollar: number
  var_95_parametric_pct: number
  risk_free_rate: number
  benchmark: string

  // Ledger-derived. Present only when transactions.json has events, since a
  // holdings snapshot carries no cash-flow timing and cannot produce them.
  realised_pl?: number
  unrealised_pl?: number
  dividends_received?: number
  fees_paid?: number
  total_pl?: number
  net_contributed?: number
  /** Time-weighted return %: what the allocation earned, ignoring when money went in. */
  time_weighted_return?: number
  /** Money-weighted return (XIRR) %: what your dollars earned, weighted by time invested. */
  money_weighted_return?: number | null
  sell_method?: 'fifo' | 'average'
  transaction_count?: number
  first_transaction?: string
  closed_positions?: string[]
}

export interface DashboardData {
  last_updated: string
  is_sample_data: boolean
  portfolio: PortfolioMetrics
  positions: Position[]
  risk_contribution: Record<string, number>
  matrices: {
    covariance: Record<string, Record<string, number>>
    correlation: Record<string, Record<string, number>>
  }
  growth_chart: Array<{ date: string; portfolio: number; [key: string]: number | string }>
}

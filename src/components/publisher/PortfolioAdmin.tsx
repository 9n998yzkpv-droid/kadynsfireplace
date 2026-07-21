'use client'

// Portfolio tab inside publisher mode. Auth is separate from the posts
// password: these APIs require a Supabase session whose member phone is on
// the ADMIN_PHONES allowlist, so the component starts by probing
// /api/admin/holdings and shows a login prompt on 401 / a setup notice on 404.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Holding {
  id: string
  ticker: string
  shares: number
  avg_cost_basis: number
  updated_at: string
}

interface Tx {
  id: string
  ticker: string
  type: 'buy' | 'sell'
  quantity: number
  price: number
  executed_at: string
  note: string | null
  created_at: string
}

type Access = 'checking' | 'ok' | 'unauthorized' | 'disabled'

const inputClass =
  'w-full px-3 py-2 rounded-md text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow'
const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}
const primaryBtn =
  'rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'
const secondaryBtn = 'rounded-md text-sm font-medium transition-colors disabled:opacity-50'
const secondaryStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
}

const fmtShares = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 6 })
const fmtMoney = (n: number) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function PortfolioAdmin() {
  const [access, setAccess] = useState<Access>('checking')
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Record-transaction form
  const [txType, setTxType] = useState<'buy' | 'sell'>('buy')
  const [txTicker, setTxTicker] = useState('')
  const [txQty, setTxQty] = useState('')
  const [txPrice, setTxPrice] = useState('')
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10))
  const [txNote, setTxNote] = useState('')
  const [txBusy, setTxBusy] = useState(false)

  // Add/edit holding form
  const [editing, setEditing] = useState<Holding | null>(null)
  const [showHoldingForm, setShowHoldingForm] = useState(false)
  const [hTicker, setHTicker] = useState('')
  const [hShares, setHShares] = useState('')
  const [hBasis, setHBasis] = useState('')
  const [hBusy, setHBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Holding | null>(null)
  const [removing, setRemoving] = useState(false)

  // History filters
  const [fTicker, setFTicker] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const loadHoldings = useCallback(async () => {
    const res = await fetch('/api/admin/holdings')
    if (res.status === 401) return setAccess('unauthorized')
    if (res.status === 404) return setAccess('disabled')
    if (!res.ok) {
      setAccess('ok')
      setError('Failed to load holdings')
      return
    }
    const data = await res.json()
    setHoldings(data.holdings ?? [])
    setAccess('ok')
  }, [])

  const loadTxs = useCallback(async () => {
    const params = new URLSearchParams()
    if (fTicker) params.set('ticker', fTicker)
    if (fFrom) params.set('from', fFrom)
    if (fTo) params.set('to', fTo)
    const res = await fetch(`/api/admin/transactions?${params}`)
    if (!res.ok) return
    const data = await res.json()
    setTxs(data.transactions ?? [])
  }, [fTicker, fFrom, fTo])

  useEffect(() => {
    loadHoldings()
  }, [loadHoldings])

  useEffect(() => {
    if (access === 'ok') loadTxs()
  }, [access, loadTxs])

  function flash(msg: string) {
    setSuccess(msg)
    setError('')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function recordTx(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setTxBusy(true)
    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: txTicker,
          type: txType,
          quantity: txQty,
          price: txPrice,
          executed_at: txDate,
          note: txNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to record transaction')
        return
      }
      flash(`Recorded ${txType} of ${txQty} ${txTicker.toUpperCase()} — holdings updated.`)
      setTxTicker(''); setTxQty(''); setTxPrice(''); setTxNote('')
      await Promise.all([loadHoldings(), loadTxs()])
    } catch {
      setError('Failed to connect to server')
    } finally {
      setTxBusy(false)
    }
  }

  function openAddHolding() {
    setEditing(null)
    setHTicker(''); setHShares(''); setHBasis('')
    setShowHoldingForm(true)
  }

  function openEditHolding(h: Holding) {
    setEditing(h)
    setHTicker(h.ticker)
    setHShares(String(h.shares))
    setHBasis(String(h.avg_cost_basis))
    setShowHoldingForm(true)
  }

  async function saveHolding(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setHBusy(true)
    try {
      const res = await fetch('/api/admin/holdings', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editing
            ? { id: editing.id, ticker: hTicker, shares: hShares, avg_cost_basis: hBasis }
            : { ticker: hTicker, shares: hShares, avg_cost_basis: hBasis }
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save holding')
        return
      }
      setShowHoldingForm(false)
      flash(editing ? `Updated ${data.holding.ticker}.` : `Added ${data.holding.ticker}.`)
      await loadHoldings()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setHBusy(false)
    }
  }

  async function removeHolding() {
    if (!removeTarget) return
    setRemoving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/holdings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: removeTarget.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to remove holding')
        return
      }
      flash(`Removed ${removeTarget.ticker}.`)
      setRemoveTarget(null)
      await loadHoldings()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setRemoving(false)
    }
  }

  if (access === 'checking') {
    return <p style={{ color: 'var(--text-muted)' }}>Checking access…</p>
  }

  if (access === 'disabled') {
    return (
      <div className="card px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Memberships aren&apos;t enabled yet. Set up Supabase and flip{' '}
        <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>MEMBERS_ENABLED</code>{' '}
        in <code className="rounded px-1" style={{ background: 'var(--surface2)' }}>src/lib/flags.ts</code>{' '}
        to manage the portfolio here.
      </div>
    )
  }

  if (access === 'unauthorized') {
    return (
      <div className="card px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <p className="mb-2">
          Portfolio management needs a member login on the admin allowlist — the posts password
          isn&apos;t enough for money data.
        </p>
        <Link href="/login" className="underline underline-offset-4" style={{ color: 'var(--accent)' }}>
          Log in with your member account →
        </Link>
      </div>
    )
  }

  const tickerOptions = Array.from(new Set(txs.map((t) => t.ticker))).sort()

  return (
    <div className="space-y-10">
      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
      {success && <p className="text-sm" style={{ color: 'var(--green)' }}>{success}</p>}

      {/* ---- Holdings ---- */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif-display text-xl tracking-tight">Holdings</h2>
          <button onClick={openAddHolding} className={`px-3 py-1.5 text-xs ${secondaryBtn}`} style={secondaryStyle}>
            + Add holding
          </button>
        </div>
        {holdings.length === 0 ? (
          <p className="py-6 text-sm" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            No positions yet. Record a buy below (or add a holding directly).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label text-left">
                  <th className="py-2 pr-3 font-medium">Ticker</th>
                  <th className="py-2 pr-3 text-right font-medium">Shares</th>
                  <th className="py-2 pr-3 text-right font-medium">Avg cost</th>
                  <th className="py-2 pr-3 text-right font-medium">Cost value</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr key={h.id} style={{ borderTop: '1px solid var(--border-faint)' }}>
                    <td className="py-2.5 pr-3 font-semibold">{h.ticker}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtShares(h.shares)}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtMoney(h.avg_cost_basis)}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtMoney(h.shares * h.avg_cost_basis)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditHolding(h)} className={`px-2.5 py-1 text-xs ${secondaryBtn}`} style={secondaryStyle}>
                          Edit
                        </button>
                        <button
                          onClick={() => setRemoveTarget(h)}
                          className={`px-2.5 py-1 text-xs ${secondaryBtn}`}
                          style={{ ...secondaryStyle, color: 'var(--red)' }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showHoldingForm && (
          <form onSubmit={saveHolding} className="card mt-4 space-y-4">
            <h3 className="text-sm font-semibold">{editing ? `Edit ${editing.ticker}` : 'Add holding'}</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Direct edits bypass the transaction log — prefer recording a buy/sell below so
              history stays the source of truth. Use this for seeding or corrections.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label mb-1.5 block">Ticker</label>
                <input value={hTicker} onChange={(e) => setHTicker(e.target.value.toUpperCase())} required placeholder="VOO" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="label mb-1.5 block">Shares</label>
                <input value={hShares} onChange={(e) => setHShares(e.target.value)} required type="number" step="any" min="0" placeholder="1.8121" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="label mb-1.5 block">Avg cost basis ($)</label>
                <input value={hBasis} onChange={(e) => setHBasis(e.target.value)} required type="number" step="any" min="0" placeholder="627.13" className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={hBusy} className={`px-4 py-2 ${primaryBtn}`} style={{ background: 'var(--accent)' }}>
                {hBusy ? 'Saving…' : editing ? 'Save changes' : 'Add holding'}
              </button>
              <button type="button" onClick={() => setShowHoldingForm(false)} className={`px-4 py-2 ${secondaryBtn}`} style={secondaryStyle}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* ---- Record transaction ---- */}
      <section>
        <h2 className="font-serif-display mb-4 text-xl tracking-tight">Record a transaction</h2>
        <form onSubmit={recordTx} className="card space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label className="label mb-1.5 block">Type</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value as 'buy' | 'sell')} className={inputClass} style={inputStyle}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Ticker</label>
              <input value={txTicker} onChange={(e) => setTxTicker(e.target.value.toUpperCase())} required placeholder="NVDA" list="held-tickers" className={inputClass} style={inputStyle} />
              <datalist id="held-tickers">
                {holdings.map((h) => (
                  <option key={h.id} value={h.ticker} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label mb-1.5 block">Quantity</label>
              <input value={txQty} onChange={(e) => setTxQty(e.target.value)} required type="number" step="any" min="0" placeholder="2.5" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="label mb-1.5 block">Price / share ($)</label>
              <input value={txPrice} onChange={(e) => setTxPrice(e.target.value)} required type="number" step="any" min="0" placeholder="186.50" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="label mb-1.5 block">Date</label>
              <input value={txDate} onChange={(e) => setTxDate(e.target.value)} required type="date" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="label mb-1.5 block">Note (optional)</label>
            <input value={txNote} onChange={(e) => setTxNote(e.target.value)} maxLength={500} placeholder="e.g. trimming after earnings run-up" className={inputClass} style={inputStyle} />
          </div>
          <button type="submit" disabled={txBusy} className={`px-5 py-2 ${primaryBtn}`} style={{ background: 'var(--accent)' }}>
            {txBusy ? 'Recording…' : `Record ${txType}`}
          </button>
        </form>
      </section>

      {/* ---- History ---- */}
      <section>
        <h2 className="font-serif-display mb-4 text-xl tracking-tight">Transaction history</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label mb-1.5 block">Ticker</label>
            <select value={fTicker} onChange={(e) => setFTicker(e.target.value)} className={inputClass} style={{ ...inputStyle, width: 'auto', minWidth: '7rem' }}>
              <option value="">All</option>
              {tickerOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">From</label>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={inputClass} style={{ ...inputStyle, width: 'auto' }} />
          </div>
          <div>
            <label className="label mb-1.5 block">To</label>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={inputClass} style={{ ...inputStyle, width: 'auto' }} />
          </div>
          {(fTicker || fFrom || fTo) && (
            <button onClick={() => { setFTicker(''); setFFrom(''); setFTo('') }} className={`px-3 py-2 text-xs ${secondaryBtn}`} style={secondaryStyle}>
              Clear filters
            </button>
          )}
        </div>
        {txs.length === 0 ? (
          <p className="py-6 text-sm" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            No transactions {fTicker || fFrom || fTo ? 'match these filters' : 'recorded yet'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label text-left">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Ticker</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Price</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                  <th className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border-faint)' }}>
                    <td className="whitespace-nowrap py-2.5 pr-3">{t.executed_at}</td>
                    <td className="py-2.5 pr-3">
                      <span className={t.type === 'buy' ? 'positive' : 'negative'}>
                        {t.type === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-semibold">{t.ticker}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtShares(t.quantity)}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtMoney(t.price)}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtMoney(t.quantity * t.price)}</td>
                    <td className="max-w-[16rem] truncate py-2.5" style={{ color: 'var(--text-secondary)' }} title={t.note ?? ''}>
                      {t.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(26,23,20,0.4)' }}>
          <div className="card mx-4 w-full max-w-sm" style={{ boxShadow: '0 4px 24px rgba(26,23,20,0.1)' }}>
            <h2 className="font-serif-display mb-2 text-xl tracking-tight">Remove holding</h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Remove <strong>{removeTarget.ticker}</strong> ({fmtShares(removeTarget.shares)} shares)
              from current holdings? The transaction history is not affected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRemoveTarget(null)} className={`flex-1 py-2 ${secondaryBtn}`} style={secondaryStyle}>
                Cancel
              </button>
              <button onClick={removeHolding} disabled={removing} className={`flex-1 py-2 ${primaryBtn}`} style={{ background: 'var(--red)' }}>
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

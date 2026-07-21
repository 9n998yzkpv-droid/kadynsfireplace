// Fire-and-forget trigger for the "Update Portfolio Data" GitHub Actions
// workflow. Called after an admin changes holdings or records a transaction,
// so the dashboard's data.json (metrics, charts) is rebuilt from the DB within
// a couple of minutes instead of waiting for the nightly cron.
//
// Same pattern as notifyN8n in /api/publish: a refresh failure must never
// fail the write that triggered it. Requires GITHUB_TOKEN with workflow
// dispatch permission (actions: write); silently does nothing if unset.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const GITHUB_REPO = process.env.GITHUB_REPO ?? '9n998yzkpv-droid/kadynsfireplace'
const WORKFLOW_FILE = 'update-portfolio.yml'

export async function triggerPortfolioRefresh(): Promise<void> {
  if (!GITHUB_TOKEN) return
  try {
    await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(5000),
      }
    )
  } catch {
    // The nightly cron will pick the change up regardless.
  }
}

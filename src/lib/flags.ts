// Feature flags.
//
// Flip PROJECTS_ENABLED to true when the interactive projects (EF Dashboard,
// Arb Scanner) are ready to go public. While false:
//   - the "More projects" section is hidden on the home page
//   - the /projects/* routes return 404 (gated in src/app/projects/layout.tsx)
export const PROJECTS_ENABLED: boolean = false

// Flip PUBLISHER_ENABLED to true ONLY once the publisher has real auth and a
// rotated secret. While false:
//   - the /publisher page returns 404 (src/app/publisher/layout.tsx)
//   - the /api/publish handlers (GET/POST/DELETE) all return 404
//   - the nav no longer advertises Publisher
// This is a public write/delete endpoint to your content repo. It is safe to be
// ON only because: the secret comes from PUBLISHER_PASSWORD (no hardcoded
// fallback — fails closed if unset), it's sent via header (never in URLs/logs),
// and compared in constant time. You MUST set a strong PUBLISHER_PASSWORD in the
// deploy environment, or the endpoint returns 503.
export const PUBLISHER_ENABLED: boolean = true

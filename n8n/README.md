# n8n Posting Backend

n8n owns all distribution for the blog. The site itself only does one thing: when a post is published through the Publisher, `/api/publish` fires a webhook to n8n with the full post. Everything downstream (LinkedIn now, TikTok/YouTube later) lives in n8n workflows.

```
Publisher → /api/publish → GitHub commit (site redeploys)
                         → n8n webhook ──→ Claude drafts LinkedIn post → LinkedIn
                                       └─→ (phase 2: faceless TikTok/YouTube pipeline)
```

## Webhook payload

Sent as `POST` with header `x-webhook-secret: $N8N_WEBHOOK_SECRET`:

```json
{
  "event": "post.published",        // or "post.updated" — the workflow only acts on new posts
  "slug": "why-the-sharpe-ratio-matters",
  "title": "Why the Sharpe Ratio Matters",
  "date": "2026-06-12",
  "excerpt": "…",
  "content": "full markdown body…",
  "url": "https://<site>/blog/why-the-sharpe-ratio-matters"
}
```

## Setup

### 1. The workflow already exists

It was built directly in the n8n Cloud instance: [Blog → LinkedIn](https://kadynsfireplace.app.n8n.cloud/workflow/QUTWbMOFZ6ss7SRN). The production webhook URL is:

```
https://kadynsfireplace.app.n8n.cloud/webhook/blog-published
```

([blog-to-linkedin.json](blog-to-linkedin.json) is kept as a backup/reference export — no need to import it.)

### 2. Create the three credentials

| Node | Credential | Values |
|---|---|---|
| Blog Published | Header Auth ("Blog Webhook Secret") | Name: `x-webhook-secret`, Value: a random secret you generate |
| Draft LinkedIn Post | Anthropic ("Anthropic") | Your Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) |
| Post to LinkedIn | LinkedIn OAuth2 ("LinkedIn account") | Follow n8n's LinkedIn guide — create a LinkedIn developer app, paste client ID/secret, connect your account |

Then open the **Post to LinkedIn** node and pick yourself in the **Person** field (it populates after the OAuth credential connects).

### 3. Point the site at n8n

Set these env vars wherever the Next.js app runs (Vercel project settings, or `.env.local` for local publishing):

```
N8N_WEBHOOK_URL=https://kadynsfireplace.app.n8n.cloud/webhook/blog-published
N8N_WEBHOOK_SECRET=<same secret as the Header Auth credential>
SITE_URL=https://<your-public-site-url>   # used to build the article link in posts
```

### 4. Activate and test

Toggle the workflow **Active** in n8n, then either publish a real post or simulate one:

```bash
curl -X POST https://kadynsfireplace.app.n8n.cloud/webhook/blog-published \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <secret>" \
  -d '{
    "event": "post.published",
    "slug": "test",
    "title": "Test Post",
    "excerpt": "A test.",
    "content": "Markets compound. Most people my age never start. That is the whole problem.",
    "url": "https://example.com/blog/test"
  }'
```

Check the execution log in n8n — you should see Claude's draft in **Extract Post Text** and the post land on LinkedIn.

> Tip: while dialing in the voice, disconnect the **Post to LinkedIn** node and just read Claude's drafts from the execution log. Reconnect once the output consistently sounds like you.

## How the draft is generated

The **Build Claude Request** Code node holds the prompt — the persona (young investor, fed up with people his age sitting out of markets, plain English, no corporate tone) and the format rules (hook first line, one real insight from the article, link at the end, 900–1300 chars). Edit that node to tune the voice. The model is `claude-opus-4-8` with adaptive thinking.

## Phase 2: faceless TikTok/YouTube pipeline

The same webhook can fan out to a second branch later: Claude writes a 60-second script from the post → TTS (e.g. ElevenLabs node) → video assembly (e.g. ffmpeg on the n8n host or a service like Creatomate) → YouTube/TikTok upload nodes. Per the plan, LinkedIn comes first — build that habit, then add this branch to the same workflow.

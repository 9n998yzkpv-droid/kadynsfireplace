import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const POSTS_DIR = path.join(process.cwd(), 'posts')
const PASSWORD = process.env.PUBLISHER_PASSWORD ?? 'fireside2024'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const GITHUB_REPO = process.env.GITHUB_REPO ?? '9n998yzkpv-droid/kadynsfireplace'
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? ''
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET ?? ''
const SITE_URL = process.env.SITE_URL ?? ''

// Hands the post off to n8n for distribution (LinkedIn etc.).
// Must never block or fail the publish itself.
async function notifyN8n(payload: Record<string, unknown>) {
  if (!N8N_WEBHOOK_URL) return
  try {
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_WEBHOOK_SECRET ? { 'x-webhook-secret': N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // n8n being down should not break publishing
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function checkPassword(password: string) {
  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  return null
}

async function githubApi(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}

async function getFileSha(filePath: string): Promise<string | null> {
  const res = await githubApi(`/contents/${filePath}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.sha
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const password = searchParams.get('password') ?? ''
    const slug = searchParams.get('slug')

    const authError = checkPassword(password)
    if (authError) return authError

    if (slug) {
      const filePath = path.join(POSTS_DIR, `${slug}.md`)
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      const raw = fs.readFileSync(filePath, 'utf8')
      const { data, content } = matter(raw)
      return NextResponse.json({
        slug,
        title: data.title ?? slug,
        date: data.date ?? '',
        excerpt: data.excerpt ?? '',
        content: content.trim(),
      })
    }

    if (!fs.existsSync(POSTS_DIR)) {
      return NextResponse.json({ posts: [] })
    }

    const files = fs.readdirSync(POSTS_DIR).filter((f: string) => f.endsWith('.md') || f.endsWith('.mdx'))
    const posts = files
      .map((filename: string) => {
        const s = filename.replace(/\.mdx?$/, '')
        const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8')
        const { data, content } = matter(raw)
        const words = content.split(/\s+/).length
        return {
          slug: s,
          title: data.title ?? s,
          date: data.date ?? '',
          excerpt: data.excerpt ?? '',
          readingTime: `${Math.max(1, Math.round(words / 200))} min read`,
        }
      })
      .sort((a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : -1))

    return NextResponse.json({ posts })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password, title, date, excerpt, content, existingSlug } = body

    const authError = checkPassword(password)
    if (authError) return authError

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured on server' }, { status: 500 })
    }

    const slug = existingSlug || slugify(title)
    const frontmatter = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `date: "${date || new Date().toISOString().slice(0, 10)}"`,
      `excerpt: "${(excerpt || '').replace(/"/g, '\\"')}"`,
      '---',
    ].join('\n')

    const markdown = `${frontmatter}\n\n${content}\n`
    const ghPath = `posts/${slug}.md`
    const encoded = btoa(unescape(encodeURIComponent(markdown)))

    const sha = await getFileSha(ghPath)
    const ghRes = await githubApi(`/contents/${ghPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: existingSlug ? `Update post: ${title}` : `Publish post: ${title}`,
        content: encoded,
        ...(sha ? { sha } : {}),
      }),
    })

    if (!ghRes.ok) {
      const errData = await ghRes.text()
      return NextResponse.json({ error: `GitHub API error: ${ghRes.status} ${errData}` }, { status: 502 })
    }

    const origin = SITE_URL || new URL(req.url).origin
    await notifyN8n({
      event: existingSlug ? 'post.updated' : 'post.published',
      slug,
      title,
      date: date || new Date().toISOString().slice(0, 10),
      excerpt: excerpt || '',
      content,
      url: `${origin}/blog/${slug}`,
    })

    return NextResponse.json({ slug })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { password, slug } = body

    const authError = checkPassword(password)
    if (authError) return authError

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GITHUB_TOKEN not configured on server' }, { status: 500 })
    }

    const ghPath = `posts/${slug}.md`
    const sha = await getFileSha(ghPath)
    if (!sha) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const ghRes = await githubApi(`/contents/${ghPath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete post: ${slug}`,
        sha,
      }),
    })

    if (!ghRes.ok) {
      const errData = await ghRes.text()
      return NextResponse.json({ error: `GitHub API error: ${ghRes.status} ${errData}` }, { status: 502 })
    }

    return NextResponse.json({ deleted: slug })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

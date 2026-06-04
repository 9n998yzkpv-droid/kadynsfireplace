import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const POSTS_DIR = path.join(process.cwd(), 'posts')
const PASSWORD = process.env.PUBLISHER_PASSWORD ?? 'fireside2024'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const GITHUB_REPO = process.env.GITHUB_REPO ?? '9n998yzkpv-droid/kadynsfireplace'

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
      ...options.headers,
    },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${text}`)
  }
  return res
}

async function getFileSha(filePath: string): Promise<string | null> {
  const res = await githubApi(`/contents/${filePath}`)
  if (res.status === 404) return null
  const data = await res.json()
  return data.sha
}

export async function GET(req: NextRequest) {
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

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  const posts = files
    .map((filename) => {
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
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, title, date, excerpt, content, existingSlug } = body

  const authError = checkPassword(password)
  if (authError) return authError

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
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

  if (GITHUB_TOKEN) {
    const sha = await getFileSha(ghPath)
    await githubApi(`/contents/${ghPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: existingSlug ? `Update post: ${title}` : `Publish post: ${title}`,
        content: Buffer.from(markdown).toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    })
  } else {
    if (!fs.existsSync(POSTS_DIR)) {
      fs.mkdirSync(POSTS_DIR, { recursive: true })
    }
    fs.writeFileSync(path.join(POSTS_DIR, `${slug}.md`), markdown, 'utf8')
  }

  return NextResponse.json({ slug })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { password, slug } = body

  const authError = checkPassword(password)
  if (authError) return authError

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
  }

  const ghPath = `posts/${slug}.md`

  if (GITHUB_TOKEN) {
    const sha = await getFileSha(ghPath)
    if (!sha) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    await githubApi(`/contents/${ghPath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete post: ${slug}`,
        sha,
      }),
    })
  } else {
    const filePath = path.join(POSTS_DIR, `${slug}.md`)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    fs.unlinkSync(filePath)
  }

  return NextResponse.json({ deleted: slug })
}

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const POSTS_DIR = path.join(process.cwd(), 'posts')
const PASSWORD = process.env.PUBLISHER_PASSWORD ?? 'fireside2024'

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const password = searchParams.get('password') ?? ''
  const slug = searchParams.get('slug')

  const authError = checkPassword(password)
  if (authError) return authError

  if (!fs.existsSync(POSTS_DIR)) {
    return NextResponse.json({ posts: [] })
  }

  if (slug) {
    const mdPath = path.join(POSTS_DIR, `${slug}.md`)
    const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`)
    const filePath = fs.existsSync(mdPath) ? mdPath : fs.existsSync(mdxPath) ? mdxPath : null
    if (!filePath) {
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

  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  const posts = files.map((filename) => {
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
  }).sort((a, b) => (a.date < b.date ? 1 : -1))

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

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true })
  }

  const filePath = path.join(POSTS_DIR, `${slug}.md`)
  fs.writeFileSync(filePath, markdown, 'utf8')

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

  const mdPath = path.join(POSTS_DIR, `${slug}.md`)
  const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`)
  const filePath = fs.existsSync(mdPath) ? mdPath : fs.existsSync(mdxPath) ? mdxPath : null

  if (!filePath) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  fs.unlinkSync(filePath)
  return NextResponse.json({ deleted: slug })
}

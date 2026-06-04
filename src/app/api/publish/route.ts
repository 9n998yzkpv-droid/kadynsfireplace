import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const POSTS_DIR = path.join(process.cwd(), 'posts')
const PASSWORD = process.env.PUBLISHER_PASSWORD ?? 'fireside2024'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password, title, date, excerpt, content } = body

  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  const slug = slugify(title)
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

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import html from 'remark-html'

const POSTS_DIR = path.join(process.cwd(), 'posts')

export interface PostMeta {
  slug: string
  title: string
  date: string
  excerpt: string
  readingTime: string
}

export interface Post extends PostMeta {
  contentHtml: string
}

export function getAllPosts(): PostMeta[] {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  return files
    .map((filename) => {
      const slug = filename.replace(/\.mdx?$/, '')
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8')
      const { data, content } = matter(raw)
      const words = content.split(/\s+/).length
      return {
        slug,
        title: data.title ?? slug,
        date: data.date ?? '',
        excerpt: data.excerpt ?? content.slice(0, 160).replace(/\n/g, ' ') + '…',
        readingTime: `${Math.max(1, Math.round(words / 200))} min read`,
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export async function getPost(slug: string): Promise<Post> {
  const mdPath = path.join(POSTS_DIR, `${slug}.md`)
  const mdxPath = path.join(POSTS_DIR, `${slug}.mdx`)
  const filePath = fs.existsSync(mdPath) ? mdPath : mdxPath
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)

  const processed = await remark().use(remarkGfm).use(html, { sanitize: false }).process(content)
  const contentHtml = processed.toString()

  const words = content.split(/\s+/).length
  return {
    slug,
    title: data.title ?? slug,
    date: data.date ?? '',
    excerpt: data.excerpt ?? '',
    readingTime: `${Math.max(1, Math.round(words / 200))} min read`,
    contentHtml,
  }
}

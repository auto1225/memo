export function migrateV1Html(html: string): string {
  if (!html) return '<p></p>'
  let out = html
  out = out.replace(/<div[^>]*class="[^"]*jan-doc-page[^"]*"[^>]*>/gi, '')
  out = out.replace(/<\/div>(?=\s*<div[^>]*class="[^"]*jan-doc-page)/gi, '')
  out = out.replace(/<div[^>]*class="[^"]*jan-page[^"]*"[^>]*>/gi, '')
  out = out.replace(/\sdata-jan-marker="[^"]*"/gi, '')
  out = out.replace(/\sdata-jan-[a-z-]+="[^"]*"/gi, '')
  out = out.replace(/\sclass="jan-[^"]*"/gi, '')
  out = out.replace(/<div(\s[^>]*)?>/gi, '<p$1>').replace(/<\/div>/gi, '</p>')
  out = out.replace(/<p[^>]*>\s*<\/p>/gi, '<p><br></p>')
  out = out.replace(/\sstyle="[^"]*"/gi, '')
  return out.trim() || '<p></p>'
}

export interface V1Note {
  id?: string
  title?: string
  html?: string
  content?: string
}

export interface V2Document {
  id?: string
  title: string
  content: string
  migratedFrom?: string
}

export function migrateNote(note: V1Note): V2Document {
  return {
    id: note.id,
    title: note.title || '무제',
    content: migrateV1Html(note.html || note.content || ''),
    migratedFrom: 'v1',
  }
}

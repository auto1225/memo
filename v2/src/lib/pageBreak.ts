export const PAGE_BREAK_HTML = '<hr class="jan-page-break" data-page-break="1" /><p></p>'

export function insertPageBreakContent(insertContent: (html: string) => unknown) {
  return insertContent(PAGE_BREAK_HTML)
}

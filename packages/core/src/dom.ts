// Strict Content-Security-Policy support for the few things we add to a page.
//
// A `style-src` without 'unsafe-inline' blocks <style> elements (ours included, in or out of a
// shadow root) unless they carry the page's nonce, and blocks style *attributes*. It does not
// block setting properties through the CSSOM, so hardened inline styles go through setProperty.

export const createStyle = (doc: Document, css: string, nonce: string | null, id?: string): HTMLStyleElement => {
  const style = doc.createElement('style')
  if (nonce) style.nonce = nonce
  if (id) style.id = id
  style.textContent = css
  return style
}

// Applies "prop:value;prop:value" declarations as !important inline styles: they beat any page
// rule, including `* { all: unset !important }`.
export const setImportant = (el: HTMLElement, declarations: string): void => {
  for (const decl of declarations.split(';')) {
    const at = decl.indexOf(':')
    if (at > 0) el.style.setProperty(decl.slice(0, at).trim(), decl.slice(at + 1).trim(), 'important')
  }
}

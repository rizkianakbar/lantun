// Strict CSPs block <style> without the page nonce and block style attributes, but not CSSOM
// writes, so hardened inline styles go through setProperty.

export function createStyle(doc: Document, css: string, nonce: string | null, id?: string): HTMLStyleElement {
  const style = doc.createElement("style");

  if (nonce) style.nonce = nonce;
  if (id) style.id = id;
  style.textContent = css;

  return style;
}

// "prop:value;prop:value" as !important inline styles, which beat `* { all: unset !important }`.
export function setImportant(el: HTMLElement, declarations: string): void {
  for (const declaration of declarations.split(";")) {
    const at = declaration.indexOf(":");

    if (at > 0) el.style.setProperty(declaration.slice(0, at).trim(), declaration.slice(at + 1).trim(), "important");
  }
}

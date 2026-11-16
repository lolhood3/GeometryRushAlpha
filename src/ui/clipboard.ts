/** Copies text. Uses the clipboard API where the page is allowed to, and the older selection command where it is not. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Not allowed here (no permission, not a secure page): try the other way.
  }
  try {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Reads the clipboard, or null when the browser does not let the page look. */
export async function pasteText(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
  } catch {
    // Refused: the player can still paste by hand.
  }
  return null;
}

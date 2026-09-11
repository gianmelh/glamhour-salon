export async function writeClipboard(text: string) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall back for mobile browsers that expose Clipboard API but reject writes.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '0'
  textarea.style.top = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.opacity = '0'
  textarea.style.fontSize = '16px'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)

  textarea.focus({ preventScroll: true })
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(textarea)
  selection?.removeAllRanges()
  selection?.addRange(range)

  const copied = document.execCommand('copy')
  selection?.removeAllRanges()
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard fallback failed')
  }
}

/** Open the picker from the whole field, including transparent input overlays. */
export function openNativePicker(input: HTMLInputElement | null) {
  if (!input) return
  input.focus()
  try {
    input.showPicker?.()
  } catch {
    // Older browsers and embedded views can reject showPicker; keep native focus.
  }
}

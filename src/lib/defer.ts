export function deferTask(callback: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
    return
  }

  setTimeout(callback, 0)
}

export function scrollMainToTop() {
  deferTask(() => {
    const main = document.querySelector('main')
    if (!main) return

    try {
      main.scrollTo({ top: 0 })
    } catch {
      main.scrollTop = 0
    }
  })
}

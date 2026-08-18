export function isOnline(): boolean {
  return navigator.onLine
}

export function subscribeOnline(handler: (online: boolean) => void): () => void {
  const on = () => handler(true)
  const off = () => handler(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
}

const getLocalStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const browserStorage = {
  getItem(key: string) {
    return getLocalStorage()?.getItem(key) ?? null
  },
  setItem(key: string, value: string) {
    getLocalStorage()?.setItem(key, value)
  },
}

export const replaceBrowserLocation = (url: string) => {
  if (typeof window === 'undefined') {
    return false
  }

  window.location.replace(url)
  return true
}

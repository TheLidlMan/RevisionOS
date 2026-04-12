import { config } from '../config'

export const buildAppLoginUrl = (search: string) => {
  const query = search.startsWith('?') ? search.slice(1) : search
  return query ? `${config.loginUrl}?${query}` : config.loginUrl
}

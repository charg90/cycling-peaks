const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1' // relative path for same-origin requests

interface Athlete {
  id: string
  name: string
  ftp: number
}

interface ApiList<T> {
  data: T[]
}

async function request<T>(path: string): Promise<T> {
  const url = BASE + path + (path.includes('?') ? '&' : '?') + '_t=' + Date.now()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export const api = {
  getAthlete: () => request<Athlete>('/athlete'),
  getSummary: <T = unknown>() => request<T>('/dashboard/summary'),
  getWorkouts: <T = unknown>(page = 1) => request<T>(`/workouts?page=${page}&limit=30`),
  getLoadToday: <T = unknown>() => request<T>('/load/today'),
  getLoadHistory: <T = unknown>(days = 90) => request<T>(`/load/history?days=${days}`),
  getSyncStatus: <T = unknown>() => request<T>('/sync/status'),
  triggerSync: () => fetch(BASE + '/sync/trigger?_t=' + Date.now(), { method: 'POST' }),
  updateFTP: (ftp: number) => fetch(BASE + '/athlete/ftp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ftp }),
  }),
  getZonesBalance: <T = unknown>(days = 90) => request<T>(`/zones/balance?days=${days}`),
  getFTPHistory: <T = unknown>(limit = 20) => request<T>(`/athlete/ftp-history?limit=${limit}`),
  getOvertrainingAlert: <T = unknown>() => request<T>('/alerts/overtraining'),
}

export type { Athlete, ApiList }

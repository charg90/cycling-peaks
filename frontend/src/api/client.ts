const BASE = '/api/v1'

interface Athlete {
  id: string
  name: string
  ftp: number
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

export const api = {
  getAthlete: () => request<Athlete>('/athlete'),
  getSummary: () => request('/dashboard/summary'),
  getWorkouts: (page = 1) => request(`/workouts?page=${page}&limit=30`),
  getLoadToday: () => request('/load/today'),
  getLoadHistory: (days = 90) => request(`/load/history?days=${days}`),
  getSyncStatus: () => request('/sync/status'),
  triggerSync: () => fetch(BASE + '/sync/trigger', { method: 'POST' }),
  updateFTP: (ftp: number) => fetch(BASE + '/athlete/ftp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ftp }),
  }),
  getZonesBalance: (days = 90) => request(`/zones/balance?days=${days}`),
  getFTPHistory: (limit = 20) => request(`/athlete/ftp-history?limit=${limit}`),
  getOvertrainingAlert: () => request('/alerts/overtraining'),
}

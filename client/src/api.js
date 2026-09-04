const TOKEN_KEY = 'talentflow_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && !path.includes('/auth/')) {
    setToken(null);
    window.location.hash = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/me'),

  candidates: () => request('/candidates'),
  candidate: (id) => request(`/candidates/${id}`),
  createCandidate: (data) => request('/candidates', { method: 'POST', body: JSON.stringify(data) }),
  updateCandidate: (id, data) => request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCandidate: (id) => request(`/candidates/${id}`, { method: 'DELETE' }),

  jobs: () => request('/jobs'),
  job: (id) => request(`/jobs/${id}`),
  createJob: (data) => request('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id, data) => request(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),

  jobMatches: (id) => request(`/jobs/${id}/matches`),
  matchesAll: () => request('/matches/all'),
  applications: () => request('/applications'),
  createApplication: (data) => request('/applications', { method: 'POST', body: JSON.stringify(data) }),
  updateApplicationStatus: (id, data) => request(`/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  publicJobs: () => request('/public/jobs'),
  publicJob: (id) => request(`/public/jobs/${id}`),
  publicApply: (data) => request('/public/applications', { method: 'POST', body: JSON.stringify(data) }),
  publicStatus: (token) => request(`/public/applications/${token}`),
  publicLookup: (email) => request('/public/applications/lookup', { method: 'POST', body: JSON.stringify({ email }) }),
};

export function formatSalary(min, max) {
  const fmt = (n) => (n ? `$${Number(n).toLocaleString()}` : null);
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}
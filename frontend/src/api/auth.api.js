import client from './client';

export const register = data => client.post('/auth/register', data).then(r => r.data);
export const login = data => client.post('/auth/login', data).then(r => r.data);
export const getMe = () => client.get('/auth/me').then(r => r.data);
export const updateMe = data => client.put('/auth/me', data).then(r => r.data);
export const changePassword = data => client.put('/auth/change-password', data).then(r => r.data);
export const deleteAccount = data => client.delete('/auth/me', { data }).then(r => r.data);

export function downloadCsv(type) {
  const token = localStorage.getItem('token');
  const baseUrl = client.defaults.baseURL || '/api';
  fetch(`${baseUrl}/export/csv/${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studifly-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
}

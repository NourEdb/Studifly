import client from './client';

export function sendWeeklyReview() {
  return client.post('/email/weekly-review').then(r => r.data);
}

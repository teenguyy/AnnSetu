/* Calls the AnnSetu FastAPI backend with the signed-in user's Supabase token. */
import { db, API_URL } from './lib.js';

export const apiReady = () => !!API_URL;

export async function api(path, body) {
  if (!API_URL) throw new Error('The AnnSetu AI service isn’t connected yet.');
  const { data } = await db.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  let r;
  try {
    r = await fetch(API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Can’t reach the AnnSetu AI service. Check your connection and try again.');
  }
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const d = j && j.detail;
    throw new Error(typeof d === 'string' ? d : r.status === 429 ? 'Too many requests. Please wait a minute.' : 'The AI service had a problem. Try again.');
  }
  return j;
}

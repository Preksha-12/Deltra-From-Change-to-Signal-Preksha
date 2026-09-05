import { WatchlistSymbol, SignificanceEvent, User, ChaosStatus } from './types.js';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('smw_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || (data.details ? data.details.join(', ') : 'Request failed');
    throw new Error(errorMsg);
  }
  return data as T;
}

export const api = {
  // Auth
  async signup(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Watchlist
  async getWatchlist(commit = true): Promise<{ items: WatchlistSymbol[]; count: number }> {
    const res = await fetch(`${API_BASE}/watchlist?commit=${commit}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async addSymbol(symbol: string): Promise<{ message: string; symbol: string; currentPrice: number }> {
    const res = await fetch(`${API_BASE}/watchlist`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ symbol }),
    });
    return handleResponse(res);
  },

  async removeSymbol(symbol: string): Promise<{ message: string; symbol: string }> {
    const res = await fetch(`${API_BASE}/watchlist/${symbol.toUpperCase()}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Attention Feed ("Since you last checked")
  async getAttentionFeed(): Promise<{ feed: SignificanceEvent[]; count: number }> {
    const res = await fetch(`${API_BASE}/watchlist/feed`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Acknowledge Attention Items / Reset baseline
  async ackWatchlist(symbols?: string[]): Promise<{ message: string; symbols: string[] }> {
    const res = await fetch(`${API_BASE}/watchlist/ack`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ symbols }),
    });
    return handleResponse(res);
  },

  // Chaos & Evaluator Controls
  async triggerChaos(params: {
    action: 'price_shock' | 'volume_spike' | 'pause_symbol' | 'out_of_order' | 'market_toggle';
    symbol?: string;
    pct?: number;
    multiplier?: number;
    paused?: boolean;
    open?: boolean;
  }): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/sim/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  async getChaosStatus(): Promise<{ status: ChaosStatus }> {
    const res = await fetch(`${API_BASE}/sim/status`);
    return handleResponse(res);
  },

  async getUniverse(): Promise<{ symbols: Array<{ symbol: string; name: string; currentPrice: number }> }> {
    const res = await fetch(`${API_BASE}/sim/universe`);
    return handleResponse(res);
  },
};

import { useEffect, useRef, useState, useCallback } from 'react';
import { SignificanceEvent } from '../api/types.js';

export interface LiveQuoteUpdate {
  symbol: string;
  price: number;
  volume: number;
  at: string;
  stale: boolean;
  marketStatus: 'open' | 'closed';
}

export function useWatchlistSocket(
  token: string | null,
  symbols: string[],
  onQuote: (quote: LiveQuoteUpdate) => void,
  onSignificantEvent: (event: SignificanceEvent) => void
) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;

  const onQuoteRef = useRef(onQuote);
  onQuoteRef.current = onQuote;

  const onEventRef = useRef(onSignificantEvent);
  onEventRef.current = onSignificantEvent;

  const connect = useCallback(() => {
    if (!token) return;

    // Use current host or proxy for websocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        // Subscribe to current watchlist symbols immediately
        if (symbolsRef.current.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            symbols: symbolsRef.current,
          }));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'quote' && data.quote) {
            onQuoteRef.current({
              symbol: data.quote.symbol,
              price: data.quote.price,
              volume: data.quote.volume,
              at: data.quote.updatedAt || data.quote.at,
              stale: !!data.quote.stale,
              marketStatus: data.quote.marketStatus || 'open',
            });
          } else if (data.type === 'quote') {
            onQuoteRef.current({
              symbol: data.symbol,
              price: data.price,
              volume: data.volume,
              at: data.at,
              stale: !!data.stale,
              marketStatus: data.marketStatus || 'open',
            });
          } else if (data.type === 'significant_event') {
            onEventRef.current(data);
          }
        } catch (err) {
          console.warn('[WS Message Error]:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Auto reconnect after 3 seconds
        setTimeout(() => {
          if (token) connect();
        }, 3000);
      };

      ws.onerror = (err) => {
        setError('WebSocket disconnected');
        setConnected(false);
      };
    } catch (err) {
      setError((err as Error).message);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  // Sync subscriptions whenever watchlist symbol list changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && symbols.length > 0) {
      socketRef.current.send(JSON.stringify({
        type: 'subscribe',
        symbols,
      }));
    }
  }, [symbols]);

  return { connected, error };
}

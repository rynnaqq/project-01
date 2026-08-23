import { supabase } from './supabase';

/**
 * Estimate the offset (ms) between the database server clock and the local
 * clock so countdowns can be computed on a common time base.
 *
 * offset ≈ serverNow - (localMidpoint), using round-trip/2 to approximate the
 * one-way latency. `correctedNow(offset)` then yields server-epoch ms locally.
 */
export async function syncServerClock(): Promise<number> {
  const t0 = Date.now();
  const { data, error } = await supabase.rpc('server_now');
  const t1 = Date.now();
  if (error || typeof data !== 'number') {
    console.error('server_now RPC failed; falling back to local clock:', error?.message);
    return 0;
  }
  const rtt = t1 - t0;
  const localMidpoint = t0 + rtt / 2;
  return data - localMidpoint;
}

/** Current time in server-epoch ms, given a previously computed offset. */
export function correctedNow(offset: number): number {
  return Date.now() + offset;
}

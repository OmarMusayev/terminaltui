/**
 * Local API route that powers the live-data page.
 * Returns sparkline + counter data that drifts every refresh so the page
 * actually animates without needing an external service.
 */

let tickCount = 0;
const cpuHistory: number[] = seed(40, 24, 5);
const memHistory: number[] = seed(60, 18, 5);
const netHistory: number[] = seed(120, 80, 5);

function seed(center: number, amplitude: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(Math.max(0, Math.round(center + (Math.random() - 0.5) * amplitude * 2)));
  }
  return out;
}

function next(history: number[], center: number, amplitude: number, max?: number): number {
  const last = history[history.length - 1] ?? center;
  const drift = (Math.random() - 0.5) * amplitude;
  const pull = (center - last) * 0.15;
  const raw = last + drift + pull;
  const clamped = Math.max(0, max !== undefined ? Math.min(max, raw) : raw);
  return Math.round(clamped);
}

export async function GET() {
  tickCount += 1;
  cpuHistory.push(next(cpuHistory, 45, 12, 100));
  memHistory.push(next(memHistory, 62, 6, 100));
  netHistory.push(next(netHistory, 140, 90));
  if (cpuHistory.length > 30) cpuHistory.shift();
  if (memHistory.length > 30) memHistory.shift();
  if (netHistory.length > 30) netHistory.shift();

  return {
    tick: tickCount,
    cpu: {
      current: cpuHistory[cpuHistory.length - 1],
      history: [...cpuHistory],
    },
    memory: {
      current: memHistory[memHistory.length - 1],
      history: [...memHistory],
    },
    network: {
      current: netHistory[netHistory.length - 1],
      history: [...netHistory],
      unit: "MB/s",
    },
    requests: {
      total: 1024 + tickCount * 3,
      perSecond: Math.round(120 + (Math.random() - 0.5) * 20),
    },
  };
}

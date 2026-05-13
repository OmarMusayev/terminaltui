# mac-monitor

Real-time macOS Activity Monitor in your terminal. No setup, no config — just run it.

```bash
npx mac-monitor
```

## What you get

- **CPU** — usage, user/sys split, cores, load average
- **Memory** — used/total, active/wired/compressed, pressure, swap
- **GPU** — chipset, cores, VRAM, Metal support, utilization
- **Disk** — per-volume usage and available space
- **Network** — active connections, local IP, interface stats
- **Battery** — charge, health, cycles, power source, temperature
- **Processes** — top 30 by CPU, filterable, live-updating

All data is real — read from macOS system commands (`ps`, `vm_stat`, `df`, `sysctl`, `pmset`, `ioreg`, `system_profiler`). Refreshes every 2-3 seconds.

## Navigation

| Key | Action |
|-----|--------|
| Up/Down | Move between items |
| Left/Right | Move between columns |
| Enter | Select page |
| Escape | Go back |
| q | Quit |

## Requirements

- **macOS only** (uses macOS-specific system commands)
- **Node.js >= 18**

## Built with

[terminaltui](https://github.com/OmarMusayev/terminaltui) — framework for building interactive terminal apps.

## License

MIT

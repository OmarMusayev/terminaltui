# Security Policy

## Supported Versions

The current minor release of `terminaltui` receives security updates. Older minors are best-effort.

| Version | Supported |
|---------|-----------|
| 1.7.x   | Yes |
| < 1.7   | No  |

## Reporting a Vulnerability

If you believe you have found a security issue in `terminaltui`, please **do not open a public GitHub issue**.

Instead:

1. Open a private report via [GitHub Security Advisories](https://github.com/OmarMusayev/terminaltui/security/advisories/new), **or**
2. Email **omar.musayev.v.2@gmail.com** with the subject line `[terminaltui security]`.

Please include:

- A description of the issue and the impact.
- Steps to reproduce, ideally with a minimal repro.
- The version of `terminaltui` and Node.js you tested against.
- Any suggested fix, if you have one.

You will receive an acknowledgement within 5 business days. We aim to ship a fix or a documented mitigation within 30 days of confirmation, sooner for high-impact issues.

## Scope

In-scope:

- The published `terminaltui` npm package (`dist/`).
- The CLI commands (`init`, `dev`, `serve`, `build`, `demo`, `create`, `test`, `art`).
- The SSH server (`terminaltui serve`).
- The HTTP API server invoked by `api/*.ts` handlers.

Out of scope:

- Issues that require local code execution by an attacker who already controls the developer's machine.
- Issues in user-authored TUI apps built with `terminaltui` (the framework is not responsible for the security of an arbitrary downstream app, the same way Express isn't responsible for the security of arbitrary Express apps).
- Denial of service against a `terminaltui serve` instance reached over the public internet without the documented hardening (`auth.passwords`, rate limits, firewalling).

## Coordinated Disclosure

We follow coordinated disclosure: please give us a reasonable window to ship a fix before publishing details. A 90-day default is fine; we will negotiate sooner or later as the severity warrants.

# Security Policy

## Reporting a Vulnerability

Do not open a public issue. Report privately through
[GitHub Security Advisories](https://github.com/Ayaan2907/hackathon-agent-harness/security/advisories/new),
or email **ayaan@advanceiq.ai** with `[security]` in the subject.

### What to include

- What you found and where (file, route, or agent tool).
- Steps to reproduce, ideally the smallest case that shows it.
- What an attacker gets out of it.
- Any suggested fix, if you have one.

## Our commitment

| Stage                       | Target   |
| --------------------------- | -------- |
| Acknowledge your report     | 48 hours |
| Initial severity assessment | 7 days   |
| Fix for high severity       | 14 days  |

Disclosure is coordinated: we agree a date with you, and you get credit unless
you would rather not be named.

## What is in scope

- This repository's application code.
- The agent definitions and skill packs under `agents/` and `profiles/`.
- Anything that lets untrusted input reach a tool call, a shell, or the filesystem.

## What is out of scope

- TrueForge, Bright Data, Daytona, and model providers themselves. Report those
  upstream. We will help you route it.
- The operational security of your own self-hosted deployment.
- Attacks requiring physical access to the operator's machine.
- Denial of service and rate-limit exhaustion.
- Findings from automated scanners with no demonstrated impact.

## Supported versions

| Version | Supported |
| ------- | --------- |
| `0.1.x` | ✅        |
| `< 0.1` | ❌        |

## The risk surface we actually care about

This project runs an agent that reads public web content and executes tools.
That shape has three sharp edges, and a report touching any of them is a P0:

1. **Scraped content becomes instructions.** Persona packs are built from public
   pages. If page content can steer the agent into calling a tool the user did
   not ask for, that is prompt injection with a real blast radius.
2. **A write escapes the approval gate.** Every destructive or write-shaped tool
   is meant to stop for human approval. A path that lands a write without one is
   the worst bug this project can have.
3. **Sandbox escape.** Repo clones and generated scripts run in a sandbox. Code
   reaching the host filesystem, host network, or host credentials is critical.

Also always in scope: credentials or tokens leaking into logs, error messages,
client bundles, or the event stream.

## Hall of fame

None yet — be the first.

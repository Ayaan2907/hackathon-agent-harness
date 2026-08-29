# hackathon-agent-harness

**Harbor Mutual Floor** — B2B supervisor glass box for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (TrueForge) and [Guava Voice AI Build Night](https://luma.com/678a9u02).

> Track: **Double-O / Best Use of TrueForge**. One irreversible action. Human approval before it lands.

This repo is the **public OSS submission**. Judges should see TrueForge doing real work: MCP tools, Daytona sandbox, `tool.approval_required`, subagents (`thread.created`), session across reconnects.

## Product (one sentence)

A claims supervisor at fictional carrier Harbor Mutual watches an agent investigate FNOL claim `HM-2847` and must **approve the reserve** before anything irreversible executes.

## Status

Bootstrap only. App scaffold waits on **Wing Mic** conventions (Next.js layout / component library) so Floor matches that codebase instead of inventing a second UI family.

| Layer | Status |
|-------|--------|
| TrueForge agent + MCP fixtures | next |
| Floor console (doing / waiting / did) | next |
| Guava WebRTC FNOL lane | tonight |

## Run (after scaffold)

```bash
# harness — https://trueforge.dev/quickstart
npx @truefoundry/trueforge

# app — TBD once Wing Mic is attached
```

## Qodo Code Review Evidence

Required for every submission. After the first reviewed PR, fill in:

- Representative merged PR: _pending_
- What Qodo surfaced and what we changed or dismissed: _pending_

## Links

- TrueForge: https://trueforge.dev
- Hackathon rules: https://www.wemakedevs.org/hackathons/trueforge
- Submit: https://forms.gle/PxGLsWW1HPyroQ5u9
- Guava: https://goguava.ai

## License

MIT

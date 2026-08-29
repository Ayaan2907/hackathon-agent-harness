# contributing

Thanks for being here.

## ground rules

0. **Read `CLAUDE.md`.** It holds the conventions this repo enforces. AI coding
   assistants load it automatically; humans should read it once.
1. One focused change per pull request.
2. CI must be green before merge: typecheck, lint, test, build.
3. Behavior changes ship with tests.
4. No secrets in code, logs, fixtures, or commits.

## quick start

You need [Bun](https://bun.sh) 1.3+ and Node 20+.

```bash
git clone https://github.com/Ayaan2907/hackathon-agent-harness.git
cd hackathon-agent-harness
bun install

# terminal 1, the agent runtime
npx @truefoundry/trueforge

# terminal 2, the console
cp .env.example .env.local   # optional, defaults already work
bun run dev
```

The app boots with zero secrets. Model, scraping, and sandbox credentials live
inside TrueForge, not here. Configure them once in the TrueForge console and
this app picks them up through the harness.

## branch + commit conventions

Branch from `main`, open a PR back to `main`.

```
feat/persona-async-job
fix/approval-strip-race
docs/architecture-why
chore/bump-next
refactor/council-scope
test/import-normalizer
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org) with
a scope:

```
feat(council): add plan-only scope toggle
fix(import): keep code fences intact when normalizing pasted markdown
docs(readme): record Qodo review evidence
```

Every PR links an issue. Put `closes #N` in the description.

## pull request checklist

The template covers it, but the load-bearing items:

- `bun run typecheck && bun run lint && bun run test && bun run build` all pass.
- Screenshots or a clip for any visual change.
- If you touched the agent loop, say which part of TrueForge it exercises and
  paste the event types you observed.
- Qodo reviewed the PR, and every High-severity finding is either fixed or
  dismissed **in the Qodo thread with a stated reason**.

## code review

Qodo reviews every substantive PR automatically once it is installed on the
repo. A human still merges. Qodo findings are advice, not a gate. But a
dismissed High finding needs a written reason, in-thread, that someone else
could disagree with.

Review comments use severity prefixes. Anything without a prefix is blocking.

- `Nit:` polish, take it or leave it
- `Optional:` a suggestion worth considering
- `FYI:` context, no action needed

## repo layout

```
app/            Next.js App Router. page.tsx (server) + XClient.tsx (client).
                _components/ for shared UI, __tests__/ colocated.
lib/            Domain logic, one exported function per file, grouped by noun.
                lib/config/env.ts is the only place process.env is read.
agents/         TrueForge agent definitions and instructions.
profiles/       Persona packs. SKILL.md + profile.yaml per reviewer.
docs/           Architecture and agent design.
```

No barrel files. Import the exact module you need.

## working with AI assistants

Most of this repo was written with an AI pair, and that is fine as long as:

- **You test what the AI writes.** It hallucinates types, APIs, and edge cases.
  The test suite is the only proof.
- **No AI co-author trailers** on commits or PR descriptions. Authorship belongs
  to the human who pressed merge.
- **AI-generated prose gets edited.** No "delve", "robust", "comprehensive",
  "seamless", "leverage". Write like a person.

## reporting bugs

Use the issue templates. A reproduction beats a description.

## security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## license

By contributing you agree that your contributions are licensed under the MIT
License, same as the rest of the project.

---

If anything in this doc is wrong, outdated, or unclear, open a PR. The first
contribution is usually the docs fix you were tempted to leave alone.

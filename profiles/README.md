# Persona packs

One directory per reviewer voice. Two files each:

```
profiles/<id>/
  profile.yaml   metadata — who this is, where it came from
  SKILL.md       the instructions that produce the voice
```

## These are not TrueForge skills

The naming is deliberate but the mechanism is different. A TrueForge skill must
be `{ type: "git", url, ref }` pointing at a public GitHub or GitLab HTTPS URL —
git is the only skill type there is, and the harness clones it inside the
sandbox at turn time.

That makes skills unusable for personas grown at runtime: a `SKILL.md` written
30 seconds ago cannot be a skill without first being pushed to a public repo.

So a pack's `SKILL.md` is read by _this app_ and layered into the agent's
`instructions` for the turn. Same file shape, different delivery. If a pack ever
becomes stable enough to publish, promoting it to a real TrueForge skill is a
git push and a settings entry.

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#skills-are-git-only).

## Provenance

`origin: fixture` packs ship with the repo. `origin: built` packs were generated
from public web content via Bright Data, and `source` records where from.

Public data only. A pack is a reading of someone's _published_ opinions — it is
not an impersonation, and nothing private ever goes in one.

## Adding one by hand

Copy `hostile/`, change the id, the stance, and the instructions. The app picks
up any directory here that has both files.

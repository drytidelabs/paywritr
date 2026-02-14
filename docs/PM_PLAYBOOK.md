# PM Playbook (Lightweight) — GitHub Issues + Projects v2

> **Purpose:** a repeatable, low-overhead system to organize any DRYTIDE LABS repo (PayBlog first) so we always have: (1) clear hierarchy (epics → tasks → sub-issues), (2) one source of truth board (Projects v2), and (3) consistent ordering (Priority + Iteration + Status).

## Principles (opinionated)
- **One board, many views.** The Project is the truth; Issues are the atoms.
- **Capture work fast, refine later.** Everything starts in **Inbox/Backlog**; grooming is scheduled.
- **Small + shippable.** Prefer tasks that ship value in ≤ 1–3 days.
- **Labels describe *what it is*. Fields describe *where it is*.**
- **CEO-minimal:** Branden only needs to do: create an issue + set **Type** + **Priority** (optional). Everything else can be delegated/automated.

---

## The Objects
### 1) Issues (single unit of work)
- Use GitHub Issues for everything: features, bugs, chores, spikes.

### 2) Epics (a container)
- **Epic = GitHub Issue with `type:epic`.**
- The epic description contains:
  - Problem / outcome
  - Scope (in/out)
  - Acceptance criteria
  - **Task list** that links child issues (use GitHub **sub-issues** / task list items).

### 3) Sub-issues (task breakdown)
- Use GitHub’s **task list → convert to issue** (sub-issues) when a bullet needs to be assigned/estimated.
- Rule: If it can be done in < 2 hours, it can stay as a checklist item; otherwise, make it a sub-issue.

### 4) Project (Projects v2)
- **Single source of truth:** every actionable issue is added to the Project.

---

## Standard Project v2 Configuration
Create **one Project per repo** (or one org-level project spanning repos if desired).

### Required fields
- **Status** (single-select):
  - `Inbox` (new/untriaged)
  - `Backlog` (triaged, not scheduled)
  - `Ready` (well-scoped; can be pulled)
  - `In Progress`
  - `In Review` (PR open / awaiting review)
  - `Blocked`
  - `Done`

- **Priority** (single-select):
  - `P0 Now` (urgent / fire)
  - `P1 Next` (next up)
  - `P2 Soon`
  - `P3 Later`

- **Iteration** (built-in iteration field):
  - 1-week or 2-week cadence. Start with **1 week** for small teams.

### Optional (recommended) fields
- **Type** (single-select) *or* use labels (pick one approach; labels are more portable):
  - `Epic`, `Feature`, `Bug`, `Chore`, `Spike`
- **Size** (single-select): `XS` `S` `M` `L` `XL`

### Recommended views
1. **Backlog** (Table)
   - Filter: `Status in (Inbox, Backlog, Ready)`
   - Sort: `Priority asc` then `Updated desc`

2. **This Iteration** (Board)
   - Filter: `Iteration is current` and `Status != Done`
   - Group by: `Status`

3. **Bugs** (Table)
   - Filter: `label: type:bug` (or Type=Bug)
   - Sort: `Priority asc`

4. **Chores** (Table)
   - Filter: `label: type:chore` (or Type=Chore)

5. **Done** (Table)
   - Filter: `Status = Done`
   - Sort: `Closed desc`

---

## Label Taxonomy (portable across repos)
Keep labels few, consistent, and namespaced.

### Type (exactly one)
- `type:epic`
- `type:feature`
- `type:bug`
- `type:chore` (maintenance/refactor/devops/docs)
- `type:spike` (time-boxed research)

### Priority (optional if using Project field)
- `prio:P0`
- `prio:P1`
- `prio:P2`
- `prio:P3`

### Status (avoid labels if using Project Status)
- **Do not** use `status:*` labels if Project Status field exists.

### Size (optional)
- `size:XS` `size:S` `size:M` `size:L` `size:XL`

### Area / component (use sparingly)
- `area:backend`
- `area:frontend`
- `area:infra`

---

## Definition of Done (DoD)
An issue is Done when:
- Acceptance criteria are met
- No secrets are committed
- Docs updated if behavior changed
- CI is green

---

## The “one-liner” procedure
When Branden says: **“Organize and order according to PM best practices.”**

Anton/Rex will:
1. Ensure every open issue has exactly one `type:*` label and a `priority:*` label.
2. Add all issues to the repo Project.
3. Reset Project fields:
   - Status → `Backlog` (unless already In Progress)
   - Iteration → cleared (unless explicitly scheduled)
4. Create/maintain epic parents (`type:epic`) with sub-issues.
5. Produce a short report: top 3 priorities + what’s blocked.

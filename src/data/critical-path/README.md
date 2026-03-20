# Critical-Path Lookup Files

This folder contains JSON lookup files that power the **"Suggest Tasks"** feature.
Each file represents the canonical ordered sequence of **high-level construction stages**
for a given state × project-type combination.

## Folder layout

```
National/                # Fallback files for any state not explicitly covered
  complete_rebuild.json
  extension.json
  renovation.json
NSW/
  complete_rebuild.json
  extension.json
<STATE>/
  <project_type>.json   # Override for a specific state
```

The registry is in `index.ts`. The schema is defined in `schema.ts`.

---

## IMPORTANT: High-level stages ONLY

> **Every entry in `tasks[]` must represent a single, named construction STAGE —
> the kind of milestone a builder would write on a whiteboard.**

**DO NOT add:**
- `description` fields enumerating sub-steps
- `steps`, `subtasks`, or `checklist` arrays
- Granular labour instructions

A brief `notes` field (1–2 sentences, regulatory callout only) is acceptable.  
`title` must be ≤ 60 characters.

Sub-task decomposition is handled elsewhere in the app and is explicitly **out of scope**
for these lookup files.

---

## Adding a new lookup file

1. Create `<STATE>/<project_type>.json` following the structure of an existing file.
2. Ensure all tasks have unique `id` values within the file.
3. Set `order` values to match the intended display sequence (they will be reassigned
   by `CriticalPathService.suggest()` after condition filtering, so raw values only
   need to be stable within the file).
4. Register the new key in `index.ts` with a static `require()` call.
5. Run `npm test -- --testPathPattern=criticalPathSchema` to validate the file
   against the schema.
6. Run `npx tsc --noEmit` to confirm TypeScript is happy.

---

## Condition expression syntax

The `condition` field supports a **whitelist-only** set of expressions.  
Only these patterns are evaluated (no `eval()`):

| Expression | Meaning |
|---|---|
| `"heritage_flag === true"` | Include if `heritage_flag` is truthy |
| `"heritage_flag === false"` | Include if `heritage_flag` is falsy |
| `"constrained_site_flag === true"` | Include if site is constrained |
| `"constrained_site_flag === false"` | — |
| `"connects_to_existing === true"` | Include if connecting to existing structure |
| `"connects_to_existing === false"` | — |

Unrecognised expressions are treated as **fail-open** (task is included).

---

## Schema reference

See [`schema.ts`](./schema.ts) for the full TypeScript interfaces.

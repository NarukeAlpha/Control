# Docs

## Labels

| Label    | Meaning                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------- |
| `design` | Visual direction, UI rules, Liquid Glass, and architectural boundaries. How it looks and feels. |
| `beta`   | In progress or shipping now. Active implementation plans and current behavior.                  |
| `v1`     | Planned next wave. Scoped, researched, but not yet started.                                     |
| `v2`     | Nice to have. Deferred until after v1 ships. No timeline.                                       |

## Area Model

Control now treats GitHub and local folders as Areas. The default GitHub Area is
`github:default`; local folder Areas discover plain Git and JJ repositories on
disk. Local repository browsing is read-only by default, and JJ passive refresh
must not run commands that snapshot or mutate the working copy.

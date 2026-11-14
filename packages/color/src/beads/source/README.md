# Fuse-bead colour sources

The `.csv` files here are unmodified copies of the `raw/` lists from
[BeadColors](https://github.com/maxcleme/beadcolors) by maxcleme (MIT licence,
see `LICENSE` in this folder), taken at commit `f97ff42` (17 Aug 2026).
Each row is `code, name, r, g, b, contributor`.

| File              | Line        | Bead size |
| ----------------- | ----------- | --------- |
| `perler.csv`      | Perler      | 5 mm      |
| `perler_mini.csv` | Perler Mini | 2.6 mm    |
| `hama.csv`        | Hama Midi   | 5 mm      |
| `hama_mini.csv`   | Hama Mini   | 2.5 mm    |
| `artkal_s.csv`    | Artkal S    | 5 mm      |
| `artkal_c.csv`    | Artkal C    | 2.6 mm    |
| `nabbi.csv`       | Nabbi       | 5 mm      |

RGB values are community measurements of real beads, so they are close
approximations, not manufacturer data. Fused beads also look slightly
different from loose ones.

## Regenerating

After updating a CSV, run from the repo root:

```
node tools/generate-bead-colors.js
```

It writes `../bead-catalogues.json` with hex, precomputed CIELAB (same math as
the DMC generator) and a finish per colour read from its name: `translucent`,
`glow`, `glitter`, `pearl`, `neon`, `metallic`, `striped` or `solid`.

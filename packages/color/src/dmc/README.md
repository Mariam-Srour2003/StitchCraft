# DMC color dataset

`dmc-colors.json` (454 entries: code, name, hex, rgb, precomputed Lab) is derived from:

- **Source**: Adrian Jongenelen, *CrossStitchCreator*,
  `CrossStitchCreator/Resources/DMC Cotton Floss converted to RGB Values.csv`
  https://github.com/adrianj/CrossStitchCreator
- This is the same underlying dataset used by the widely-cited
  [`sharlagelfand/dmc`](https://github.com/sharlagelfand/dmc) R package
  ("Convert Colour to DMC Embroidery Floss and Back").

## Regenerating

`source.csv` in this folder is the checked-in, unmodified source data. To
regenerate `dmc-colors.json` (e.g. after correcting an entry in the CSV),
run from the repo root:

```
node tools/generate-dmc-colors.js
```

This parses `source.csv` and computes CIELAB (D65, 2-degree observer) for
every entry from its RGB value, so `nearestDmc` never has to convert color
spaces at match time.

## Known gaps

- Anchor thread codes are not included (DMC only, see `PLAN.md` assumptions).
- Diamond-painting "drill" colors reuse this same DMC set rather than a
  separate manufacturer list, since real diamond painting kits are commonly
  DMC-numbered.

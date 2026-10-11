import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SHORTCUTS } from '@app/domain/editor/shortcuts';

export const GLOSSARY: readonly { term: string; definition: string }[] = [
  {
    term: 'Aida',
    definition:
      'The most common cross-stitch fabric: an even weave with clear holes at each square.',
  },
  {
    term: 'Count',
    definition:
      'Stitches per inch of fabric. 14-count Aida fits 14 stitches in an inch; higher counts make a smaller, finer piece.',
  },
  {
    term: 'Floss / thread',
    definition:
      'Embroidery cotton. A DMC skein is 8 m long and made of 6 strands you separate before stitching.',
  },
  {
    term: 'Strands',
    definition:
      'How many of the 6 floss strands you stitch with at once: usually 2 on 14-count, 3 on 11-count, 1 on very fine fabric.',
  },
  {
    term: 'Skein',
    definition:
      'One bundle of floss. StitchCraft estimates how many you need per color from the stitch count and fabric.',
  },
  { term: 'Full cross stitch', definition: 'One "X" covering one square of the chart.' },
  {
    term: 'Backstitch',
    definition:
      'Straight outline stitches along the edges of squares, used for detail and lettering.',
  },
  {
    term: 'Half / quarter stitch',
    definition:
      'Part of a cross: a half stitch is one diagonal, a quarter runs from a corner to the centre. Used for curves and fine detail.',
  },
  {
    term: 'Confetti',
    definition:
      'Single stitches of a color scattered on their own - slow to stitch. Photo conversions make lots; Clean up removes them.',
  },
  {
    term: 'Drill',
    definition:
      'A tiny resin "diamond" placed on the sticky canvas in diamond painting. Usually 2.5-2.8 mm.',
  },
  {
    term: 'Square vs round drills',
    definition:
      'Square drills sit edge to edge for a full mosaic look; round drills are easier to place and sparkle more.',
  },
  {
    term: 'Chart',
    definition: 'The printed grid where each symbol tells you which color goes in each square.',
  },
  {
    term: 'Centre lines',
    definition:
      'Marks at the middle of the chart. Most stitchers start from the centre of the fabric so the design ends up centred.',
  },
  {
    term: 'Paint by number',
    definition:
      'A canvas divided into outlined regions, each numbered with the paint color that fills it.',
  },
];

const FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'How big will my finished piece be?',
    a: 'Divide the stitch count by the fabric count: an 84 × 70 pattern on 14-count is 6 × 5 inches. Add a few inches of margin on every side for framing. The Calculators page does this for you.',
  },
  {
    q: 'How accurate are the skein estimates?',
    a: 'They assume full cross stitches, the usual strand count for your fabric and 30% waste, which lands around 1,900 stitches per skein on 14-count with 2 strands. Buy one extra skein of your main colors if dye lots matter to you.',
  },
  {
    q: 'Why do converted photos look blocky?',
    a: 'Every square is one stitch, so detail depends on size. Try a larger pattern width, fewer colors for bold graphic images, or more colors for photos.',
  },
  {
    q: 'Where is my stitching progress saved?',
    a: 'With the pattern itself, when you press Save in the editor, so it follows you between devices.',
  },
  {
    q: 'Where are my thread stash and settings saved?',
    a: 'In this browser. They are not uploaded yet, so they will not appear on another device or in a private window.',
  },
];

@Component({
  selector: 'sc-help',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  protected readonly glossary = GLOSSARY;
  protected readonly faq = FAQ;
  protected readonly shortcuts = SHORTCUTS;
}

# Three Mice 🐭🐭🐭

Everyone's adding dark mode switchers, but what about mouse mode? This is a tiny cursor wardrobe for your site's homepage. A little pill appears in the upper right corner with three mice to choose from:

| Mode | What it does |
| --- | --- |
| **Blob** (default) | The native cursor disappears and a faded blob oozes after the pointer — six trailing metaballs fused with an SVG gooey filter. It squashes and stretches along its direction of travel, and over links it swells and turns near-solid so "clickable" reads instantly. Leave the mouse still for five seconds and it gets restless — droplets tear off in slow motion, drift, and dissolve. |
| **Pixel** | The classic chunky pixel arrow at 2× scale — white fill, black outline, notched tail — with the classic deep-knuckled pointing hand over links and buttons. Drawn from 1-bit bitmaps onto a canvas at runtime, so every pixel is a fat, honest pixel. |
| **Loupe** | A 168px magnifying glass that *is* the cursor (the native one hides) and enlarges the page 1.7× — a live, scaled clone of the page rendered inside the circle, so text stays vector-crisp. No border or drop shadow — just the faintest flat-top loupe glass (hairline rim, even sheen) so it stays findable over flat backgrounds. |

Details:

- The choice is remembered per visitor in `localStorage`.
- The widget detects dark sites from the page background and flips its whole
  palette — dark frosted pill, ivory blob — automatically.
- Hovering anywhere over the picker hands control back to the normal system
  cursor (and the blob/loupe melt out of the way) so choosing is never fiddly.
- Link detection is forgiving: anything interactive within ~18px of the
  pointer counts as a hover, so the blob doesn't demand pixel-perfect aim.
- Mouse users only (`pointer: fine`); phones and tablets are left alone.
- Entrance/wobble animations respect `prefers-reduced-motion`.

## Install

Copy (or zip and upload) this folder into `wp-content/plugins/` and activate
**Three Mice** in wp-admin. No settings — it just shows up on the homepage.

## Where it appears

By default only on the homepage (`is_front_page() || is_home()`). To show it
everywhere:

```php
add_filter( 'three_mice_should_load', '__return_true' );
```

## Try it without WordPress

Open `demo.html` through any local web server — it's a fake dark homepage with
the plugin's CSS/JS wired up.

## Notes

- The picker is `position: fixed` at `top: 18px; right: 18px` — if it crowds
  your theme's nav, nudge `.tm-root` in `assets/three-mice.css`.
- The lens clones `document.body` on activation and strips scripts, iframes,
  and videos from the clone. If your homepage changes after load (infinite
  scroll, etc.) the lens view refreshes the next time it's re-selected or the
  window is resized.

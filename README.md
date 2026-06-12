# Mouse Mode 🐭

Everyone's adding dark mode switchers, but what about mouse mode? This is a tiny cursor wardrobe for your site's homepage. A little pill appears in the upper right corner with three mouse modes to choose from: A blob (default), Loupe (good for photo heavy blogs), and a way to switch to the normal/default cursor. 

See it in action on my personal site: https://kelly.blog/

Details:

- The choice is remembered per visitor in `localStorage`.
- The widget detects dark sites from the page background and flips its whole
  palette automatically.
- Hovering anywhere over the picker hands control back to the normal system
  cursor (and the blob/loupe melt out of the way) so choosing is never fiddly.
- Link detection is forgiving: anything interactive within ~18px of the
  pointer counts as a hover, so the blob doesn't demand pixel-perfect aim.
- Mouse users only (`pointer: fine`); phones and tablets are left alone.
- Entrance/wobble animations respect `prefers-reduced-motion`.

## Install

Copy (or zip and upload) this folder into `wp-content/plugins/` and activate
**Mouse Mode** in wp-admin. No settings, it just shows up on the homepage.

## Where it appears

By default only on the homepage (`is_front_page() || is_home()`). To show it
everywhere:

```php
add_filter( 'mouse_mode_should_load', '__return_true' );
```

## Try it without WordPress

Open `demo.html` through any local web server, it's a fake dark homepage with
the plugin's CSS/JS wired up.

## Notes

- The picker is `position: fixed` at `top: 45px; right: 25px` (the top offset
  clears the WordPress admin bar) — nudge `.tm-root` in `assets/mouse-mode.css`
  if it crowds your theme's nav.
- The loupe clones `document.body` on activation and strips scripts, iframes,
  and videos from the clone. If your homepage changes after load (infinite
  scroll, etc.) the loupe view refreshes the next time it's re-selected or the
  window is resized.

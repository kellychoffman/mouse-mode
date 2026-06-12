/**
 * Mouse Mode — a tiny cursor wardrobe.
 *
 * Three mouse modes, picked from a little pill in the upper right:
 *   blob   — a faded blob that oozes after the pointer (gooey metaballs)
 *   normal — the plain default cursor, no effect (for the normies)
 *   lens   — a 112px magnifying loupe that enlarges a live clone of the page
 */
(function () {
	'use strict';

	// Mouse-driven effects make no sense on touch devices.
	var fine = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
	if (fine && !fine.matches) return;
	if (window.__mouseMode) return;
	window.__mouseMode = true;

	var STORAGE_KEY = 'mouse-mode:mode';
	var ORDER = ['blob', 'normal', 'lens'];
	var DEFAULT_MODE = 'blob';
	var INTERACTIVE =
		'a, button, input, textarea, select, summary, label, [role="button"], [onclick]';

	/* ------------------------------------------------------------------ *
	 * Shared pointer + page state
	 * ------------------------------------------------------------------ */

	var pointer = {
		x: window.innerWidth / 2,
		y: window.innerHeight / 3,
		hover: false,
		overPicker: false,
		away: false, // over an embed or out of the window — no events coming
		lastEvent: 0,
		seen: false,
	};

	function isEmbed(el) {
		var tag = el && el.tagName;
		return tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT';
	}

	// Is the pointer's last known position within `pad` px of any embed?
	function nearEmbed(pad) {
		var embeds = document.querySelectorAll('iframe, embed, object');
		for (var i = 0; i < embeds.length; i++) {
			var r = embeds[i].getBoundingClientRect();
			if (
				pointer.x > r.left - pad && pointer.x < r.right + pad &&
				pointer.y > r.top - pad && pointer.y < r.bottom + pad
			) {
				return true;
			}
		}
		return false;
	}

	// Last-ditch net: if mousemove has gone silent and the last known
	// position is at/near an embed, the pointer almost certainly slid
	// into it (embeds swallow events without telling the parent).
	function silentNearEmbed(now) {
		if (pointer.away || !pointer.seen) return false;
		if (now - pointer.lastEvent < 300) return false;
		return nearEmbed(28);
	}

	function isInteractive(el) {
		return !!(el && el.closest && el.closest(INTERACTIVE));
	}

	// A forgiving target: count the pointer as "on" a link if anything
	// interactive sits within ~18px, not just dead-center under it.
	var REACH = [
		[18, 0], [-18, 0], [0, 18], [0, -18],
		[13, 13], [-13, 13], [13, -13], [-13, -13],
	];

	function nearInteractive(x, y) {
		for (var i = 0; i < REACH.length; i++) {
			if (isInteractive(document.elementFromPoint(x + REACH[i][0], y + REACH[i][1]))) {
				return true;
			}
		}
		return false;
	}

	document.addEventListener(
		'mousemove',
		function (e) {
			pointer.x = e.clientX;
			pointer.y = e.clientY;
			pointer.seen = true;
			pointer.away = false;
			pointer.lastEvent = performance.now();
			var t = e.target;
			pointer.hover =
				isInteractive(t) || nearInteractive(e.clientX, e.clientY);
			pointer.overPicker = !!(t && t.closest && t.closest('.tm-root'));
		},
		{ passive: true }
	);

	// Iframes (YouTube embeds etc.) swallow every mouse event, so the page
	// stops hearing mousemove the moment the pointer crosses onto one and
	// the blob/loupe would freeze mid-air. Browsers are inconsistent about
	// which boundary events the parent still gets, so we listen for both
	// sides of the crossing — mouseover targeting the embed, and mouseout
	// whose relatedTarget is the embed (or null, i.e. the pointer left the
	// window entirely). The effects melt away until the pointer returns;
	// silentNearEmbed() in the animation loops is the final fallback.
	document.addEventListener(
		'mouseover',
		function (e) {
			if (isEmbed(e.target)) pointer.away = true;
		},
		{ passive: true, capture: true }
	);

	document.addEventListener(
		'mouseout',
		function (e) {
			if (!e.relatedTarget || isEmbed(e.relatedTarget)) {
				pointer.away = true;
			}
		},
		{ passive: true, capture: true }
	);

	function pageBackground() {
		var nodes = [document.body, document.documentElement];
		for (var i = 0; i < nodes.length; i++) {
			var bg = getComputedStyle(nodes[i]).backgroundColor;
			if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
				return bg;
			}
		}
		return '#fff';
	}

	// Flip the widget + blob palette on dark sites.
	function applyTheme() {
		var dark = false;
		var m = pageBackground().match(/rgba?\(([^)]+)\)/);
		if (m) {
			var p = m[1].split(',');
			var lum =
				(0.2126 * parseFloat(p[0]) +
					0.7152 * parseFloat(p[1]) +
					0.0722 * parseFloat(p[2])) / 255;
			dark = lum < 0.5;
		}
		document.documentElement.classList.toggle('tm-on-dark', dark);
	}

	/* ------------------------------------------------------------------ *
	 * Effect: normal — the plain default cursor, no effect at all
	 * ------------------------------------------------------------------ */

	var normal = {
		enable: function () {},
		disable: function () {},
	};

	/* ------------------------------------------------------------------ *
	 * Effect: blob — gooey trailing blob that oozes after the pointer
	 * ------------------------------------------------------------------ */

	var REDUCED_MOTION = window.matchMedia &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	var blob = (function () {
		var stage = null;
		var goo = null;
		var parts = [];
		var drops = [];
		var raf = 0;
		var mainScale = 1;
		var fade = 1;
		var ink = 0.5;
		var vx = 0;
		var vy = 0;
		var lastPX = -1;
		var lastPY = -1;
		var lastMove = 0;
		var lastSpawn = 0;
		var SIZES = [46, 33, 25, 19, 14, 10];

		function build() {
			stage = document.createElement('div');
			stage.className = 'tm-blob-stage';
			stage.setAttribute('data-tm-ignore', '');
			stage.setAttribute('aria-hidden', 'true');

			// Gooey filter: blur the dots, then crush the alpha channel so
			// overlapping blurs fuse into one metaball surface.
			stage.innerHTML =
				'<svg class="tm-defs" width="0" height="0" aria-hidden="true"><defs>' +
				'<filter id="tm-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>' +
				'<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"/>' +
				'</filter></defs></svg>' +
				'<div class="tm-goo"></div>';

			goo = stage.querySelector('.tm-goo');

			parts = SIZES.map(function (size, i) {
				var el = document.createElement('div');
				el.className = 'tm-dot' +
					(i === 0 ? ' tm-dot--main' : i === 1 ? ' tm-dot--second' : '');
				el.style.width = size + 'px';
				el.style.height = size + 'px';
				goo.appendChild(el);
				return { el: el, size: size, x: pointer.x, y: pointer.y };
			});

			document.body.appendChild(stage);
		}

		// A droplet detaches from the blob. Two flavours:
		//  - idle ooze: glacial, drifts a hair, dissolves over ~12s.
		//  - fling: shears off the back of a fast-moving blob and fades fast.
		function spawnDrop(now, fling) {
			lastSpawn = now;
			var el = document.createElement('div');
			el.className = 'tm-dot';
			// Droplets must stay chunky: the goo filter's alpha crush
			// erases anything smaller than ~18px, so drops start large
			// and the threshold itself swallows them at the end of life.
			var size = 20 + Math.random() * 8;
			el.style.width = size + 'px';
			el.style.height = size + 'px';
			goo.appendChild(el);

			var ang, sp;
			if (fling) {
				// Sling off roughly opposite the blob's travel, like wet
				// droplets thrown from a whipping ball.
				ang = Math.atan2(vy, vx) + Math.PI + (Math.random() - 0.5) * 1.6;
				sp = 1.4 + Math.random() * 2.2;
			} else {
				ang = Math.random() * Math.PI * 2;
				// Glacial: the drop spends ages pulling a taffy neck out of
				// the blob before it finally oozes free.
				sp = 0.07 + Math.random() * 0.08;
			}
			drops.push({
				el: el,
				size: size,
				// Start tucked into the blob so the pull-away reads.
				x: parts[0].x + Math.cos(ang) * SIZES[0] * 0.3,
				y: parts[0].y + Math.sin(ang) * SIZES[0] * 0.3,
				vx: Math.cos(ang) * sp,
				vy: Math.sin(ang) * sp - (fling ? 0 : 0.03),
				// Fling drops fade in ~0.6-1s; idle drops crawl out over ~12s.
				decay: fling ? 0.018 + Math.random() * 0.012 : 0.0014,
				damp: fling ? 0.93 : 0.999,
				life: 1,
			});
		}

		function clearDrops() {
			drops.forEach(function (d) {
				if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
			});
			drops = [];
		}

		function tick() {
			if (pointer.seen) stage.style.visibility = 'visible';

			var now = performance.now();
			if (silentNearEmbed(now)) pointer.away = true;

			// Melt away over the picker (normal cursor takes over) and
			// over embeds / out of the window (no events coming).
			fade += ((pointer.overPicker || pointer.away ? 0 : 1) - fade) * 0.2;
			stage.style.opacity = fade.toFixed(3);
			if (Math.abs(pointer.x - lastPX) > 2 || Math.abs(pointer.y - lastPY) > 2) {
				lastPX = pointer.x;
				lastPY = pointer.y;
				lastMove = now;
			}
			var idle = now - lastMove;
			var moveSpeed = Math.sqrt(vx * vx + vy * vy);

			if (!REDUCED_MOTION && pointer.seen && fade > 0.5 && !pointer.away) {
				// Fling: the faster the blob travels, the better the odds a
				// droplet shears off the back this frame, then quickly fades.
				if (
					moveSpeed > 5 && drops.length < 14 &&
					Math.random() < Math.min(0.55, (moveSpeed - 5) * 0.03)
				) {
					spawnDrop(now, true);
				} else if (
					// Idle ooze: after five still seconds, one slow drop at a
					// time — the next waits for the current to dissolve.
					idle > 5000 && drops.length === 0 && now - lastSpawn > 1500
				) {
					spawnDrop(now, false);
				}
			}

			for (var d = drops.length - 1; d >= 0; d--) {
				var dr = drops[d];
				dr.life -= dr.decay;
				if (dr.life <= 0) {
					goo.removeChild(dr.el);
					drops.splice(d, 1);
					continue;
				}
				dr.x += dr.vx;
				dr.y += dr.vy;
				dr.vx *= dr.damp;
				dr.vy *= dr.damp;
				// Scale floor keeps the drop above the goo threshold for
				// most of its life; it winks out near the end.
				var ds = 0.5 + 0.5 * dr.life;
				dr.el.style.transform =
					'translate3d(' + (dr.x - dr.size / 2) + 'px,' +
					(dr.y - dr.size / 2) + 'px,0) scale(' + ds.toFixed(3) + ')';
			}

			// Densify over links: the faded blob turns near-solid so
			// "clickable" reads instantly.
			ink += ((pointer.hover && !pointer.overPicker ? 0.92 : 0.5) - ink) * 0.18;
			goo.style.opacity = ink.toFixed(3);

			// The lead blob chases the pointer; each trailing blob chases
			// the one before it — that lag is the ooze.
			for (var i = 0; i < parts.length; i++) {
				var p = parts[i];
				var tx = i === 0 ? pointer.x : parts[i - 1].x;
				var ty = i === 0 ? pointer.y : parts[i - 1].y;
				var k = i === 0 ? 0.16 : 0.26;
				var ox = p.x;
				var oy = p.y;
				p.x += (tx - p.x) * k;
				p.y += (ty - p.y) * k;

				var base = 'translate3d(' + (p.x - p.size / 2) + 'px,' +
					(p.y - p.size / 2) + 'px,0)';

				if (i === 0) {
					// Squash & stretch along the direction of travel, so the
					// blob leans into the move like dripping liquid.
					vx += (p.x - ox - vx) * 0.25;
					vy += (p.y - oy - vy) * 0.25;
					var speed = Math.sqrt(vx * vx + vy * vy);
					var stretch = Math.min(0.45, speed * 0.035);
					var ang = Math.atan2(vy, vx);
					mainScale += ((pointer.hover && !pointer.overPicker ? 1.6 : 1) - mainScale) * 0.15;
					p.el.style.transform = base +
						' rotate(' + ang + 'rad)' +
						' scale(' + mainScale * (1 + stretch) + ',' +
						mainScale * (1 - stretch * 0.55) + ')' +
						' rotate(' + -ang + 'rad)';
				} else {
					p.el.style.transform = base;
				}
			}

			raf = requestAnimationFrame(tick);
		}

		function enable() {
			if (!stage) build();
			stage.style.display = '';
			stage.style.visibility = pointer.seen ? 'visible' : 'hidden';
			fade = 1;
			lastMove = performance.now();
			parts.forEach(function (p) {
				p.x = pointer.x;
				p.y = pointer.y;
			});
			document.documentElement.classList.add('tm-mode-blob');
			raf = requestAnimationFrame(tick);
		}

		function disable() {
			document.documentElement.classList.remove('tm-mode-blob');
			cancelAnimationFrame(raf);
			clearDrops();
			if (stage) stage.style.display = 'none';
		}

		return { enable: enable, disable: disable };
	})();

	/* ------------------------------------------------------------------ *
	 * Effect: lens — a magnifying circle over a scaled live page clone
	 * ------------------------------------------------------------------ */

	var lens = (function () {
		var SIZE = 168;
		var R = SIZE / 2;
		var ZOOM = 1.7;

		var el = null;
		var inner = null;
		var raf = 0;
		var resizeTimer = 0;
		var lx = 0;
		var ly = 0;
		var fade = 1;

		function build() {
			el = document.createElement('div');
			el.className = 'tm-lens';
			el.setAttribute('data-tm-ignore', '');
			el.setAttribute('aria-hidden', 'true');
			el.innerHTML =
				'<div class="tm-lens-inner"></div><div class="tm-lens-glass"></div>';
			inner = el.querySelector('.tm-lens-inner');
			document.body.appendChild(el);
		}

		function rebuildClone() {
			inner.innerHTML = '';
			inner.style.background = pageBackground();

			var clone = document.body.cloneNode(true);
			var junk = clone.querySelectorAll(
				'script, noscript, iframe, video, [data-tm-ignore], #wpadminbar'
			);
			for (var i = 0; i < junk.length; i++) {
				junk[i].parentNode.removeChild(junk[i]);
			}
			clone.style.margin = '0';
			clone.style.width = document.documentElement.clientWidth + 'px';
			clone.style.pointerEvents = 'none';

			inner.appendChild(clone);
			if ('inert' in inner) inner.inert = true;
		}

		function tick() {
			if (pointer.seen) el.style.visibility = 'visible';

			// Anywhere near an embed, the loupe stands down completely and
			// the regular cursor comes back — no waiting on events that
			// iframes may never deliver.
			var paused = pointer.seen && nearEmbed(40);
			document.documentElement.classList.toggle('tm-lens-paused', paused);

			// Step aside while choosing a cursor in the picker, near/over
			// embeds, and out of the window (no events coming).
			fade += ((pointer.overPicker || pointer.away || paused ? 0 : 1) - fade) * 0.2;
			el.style.opacity = fade.toFixed(3);

			lx += (pointer.x - lx) * 0.3;
			ly += (pointer.y - ly) * 0.3;
			el.style.transform =
				'translate3d(' + (lx - R) + 'px,' + (ly - R) + 'px,0)';

			// Map the page point under the lens center to the lens center,
			// scaled: translate(R - zoom * pagePoint) then scale(zoom).
			var px = lx + window.scrollX;
			var py = ly + window.scrollY;
			inner.style.transform =
				'translate(' + (R - ZOOM * px) + 'px,' + (R - ZOOM * py) +
				'px) scale(' + ZOOM + ')';

			raf = requestAnimationFrame(tick);
		}

		function onResize() {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(rebuildClone, 250);
		}

		function enable() {
			if (!el) build();
			rebuildClone();
			lx = pointer.x;
			ly = pointer.y;
			// Start transparent and fade in via the tick lerp, and
			// pre-position at the pointer so the first frame never paints
			// in the corner — both of which would otherwise read as a swoop.
			fade = 0;
			el.style.opacity = '0';
			el.style.transform =
				'translate3d(' + (lx - R) + 'px,' + (ly - R) + 'px,0)';
			el.style.display = '';
			el.style.visibility = pointer.seen ? 'visible' : 'hidden';
			document.documentElement.classList.add('tm-mode-lens');
			window.addEventListener('resize', onResize);
			raf = requestAnimationFrame(tick);
		}

		function disable() {
			document.documentElement.classList.remove('tm-mode-lens');
			document.documentElement.classList.remove('tm-lens-paused');
			window.removeEventListener('resize', onResize);
			cancelAnimationFrame(raf);
			clearTimeout(resizeTimer);
			if (el) {
				el.style.display = 'none';
				inner.innerHTML = '';
			}
		}

		return { enable: enable, disable: disable };
	})();

	/* ------------------------------------------------------------------ *
	 * The picker pill
	 * ------------------------------------------------------------------ */

	var EFFECTS = { normal: normal, blob: blob, lens: lens };
	var current = null;
	var buttons = {};

	var ICONS = {
		normal:
			'<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">' +
			'<path fill="currentColor" d="M4 2.2 5.2 14.4 7.7 11.1 9.8 15.8 11.6 15 9.5 10.4 13.6 9.8Z"/></svg>',
		blob:
			'<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">' +
			'<path fill="currentColor" d="M9 2.4c2.9 0 5.9 1.7 6.3 4.6.4 2.8-1.1 4.3-1.5 6.2-.4 1.9-2 3-4.3 2.7-2.3-.3-2.7-2-4.6-2.8C3 12.3 1.9 10.8 2.3 8.6 2.8 5.2 6.1 2.4 9 2.4Z"/></svg>',
		lens:
			'<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor">' +
			'<circle cx="9" cy="9" r="6.2" stroke-width="1.5"/>' +
			'<path d="M5.4 7.4a4.4 4.4 0 0 1 2-2" stroke-width="1.5" stroke-linecap="round"/>' +
			'<circle cx="10.8" cy="10.8" r="1.3" fill="currentColor" stroke="none"/></svg>',
	};

	var LABELS = { normal: 'Normal', blob: 'Blob', lens: 'Loupe' };

	function setMode(mode, save) {
		if (!EFFECTS[mode] || mode === current) return;
		if (current) EFFECTS[current].disable();
		current = mode;
		EFFECTS[mode].enable();

		Object.keys(buttons).forEach(function (key) {
			var on = key === mode;
			buttons[key].setAttribute('aria-checked', on ? 'true' : 'false');
			buttons[key].tabIndex = on ? 0 : -1;
			buttons[key].classList.toggle('tm-pop', on);
		});

		if (save) {
			try {
				localStorage.setItem(STORAGE_KEY, mode);
			} catch (e) {
				/* private mode — fine, just don't persist */
			}
		}
	}

	function buildPicker() {
		var root = document.createElement('div');
		root.className = 'tm-root';
		root.setAttribute('data-tm-ignore', '');

		var pill = document.createElement('div');
		pill.className = 'tm-pill';
		pill.setAttribute('role', 'radiogroup');
		pill.setAttribute('aria-label', 'Cursor style');

		ORDER.forEach(function (mode) {
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'tm-btn tm-btn--' + mode;
			btn.setAttribute('role', 'radio');
			btn.setAttribute('aria-checked', 'false');
			btn.setAttribute('aria-label', LABELS[mode] + ' cursor');

			btn.innerHTML = ICONS[mode];

			var tip = document.createElement('span');
			tip.className = 'tm-tip';
			tip.textContent = LABELS[mode];
			btn.appendChild(tip);

			btn.addEventListener('click', function () {
				setMode(mode, true);
			});

			buttons[mode] = btn;
			pill.appendChild(btn);
		});

		// Roving arrow-key focus, radio-group style.
		pill.addEventListener('keydown', function (e) {
			var idx = ORDER.indexOf(current);
			var next = null;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
				next = ORDER[(idx + 1) % ORDER.length];
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
				next = ORDER[(idx + ORDER.length - 1) % ORDER.length];
			}
			if (next) {
				e.preventDefault();
				setMode(next, true);
				buttons[next].focus();
			}
		});

		root.appendChild(pill);
		document.body.appendChild(root);
	}

	function init() {
		applyTheme();
		buildPicker();
		var saved = null;
		try {
			saved = localStorage.getItem(STORAGE_KEY);
		} catch (e) {
			/* ignore */
		}
		setMode(EFFECTS[saved] ? saved : DEFAULT_MODE, false);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

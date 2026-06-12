<?php
/**
 * Plugin Name:       Mouse Mode
 * Plugin URI:        https://kelly.blog
 * Description:       A tiny cursor wardrobe for your homepage — pick between an oozing blob, the normal cursor, or a magnifying loupe.
 * Version:           1.0.0
 * Author:            Kelly Hoffman
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mouse-mode
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the cursor picker should load on the current request.
 * Defaults to the homepage only. Filter `mouse_mode_should_load`
 * to show it elsewhere (e.g. `__return_true` for the whole site).
 */
function mouse_mode_should_load() {
	$should = is_front_page() || is_home();
	return (bool) apply_filters( 'mouse_mode_should_load', $should );
}

function mouse_mode_enqueue_assets() {
	if ( ! mouse_mode_should_load() ) {
		return;
	}

	$dir = plugin_dir_path( __FILE__ );
	$url = plugin_dir_url( __FILE__ );

	wp_enqueue_style(
		'mouse-mode',
		$url . 'assets/mouse-mode.css',
		array(),
		(string) filemtime( $dir . 'assets/mouse-mode.css' )
	);

	wp_enqueue_script(
		'mouse-mode',
		$url . 'assets/mouse-mode.js',
		array(),
		(string) filemtime( $dir . 'assets/mouse-mode.js' ),
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'mouse_mode_enqueue_assets' );

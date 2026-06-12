<?php
/**
 * Plugin Name:       Three Mice
 * Plugin URI:        https://kelly.blog
 * Description:       A tiny cursor wardrobe for your homepage — pick between a pixelated retro arrow, an oozing ink blob, or a magnifying lens.
 * Version:           1.0.0
 * Author:            Kelly Hoffman
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       three-mice
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the cursor picker should load on the current request.
 * Defaults to the homepage only. Filter `three_mice_should_load`
 * to show it elsewhere (e.g. `__return_true` for the whole site).
 */
function three_mice_should_load() {
	$should = is_front_page() || is_home();
	return (bool) apply_filters( 'three_mice_should_load', $should );
}

function three_mice_enqueue_assets() {
	if ( ! three_mice_should_load() ) {
		return;
	}

	$dir = plugin_dir_path( __FILE__ );
	$url = plugin_dir_url( __FILE__ );

	wp_enqueue_style(
		'three-mice',
		$url . 'assets/three-mice.css',
		array(),
		(string) filemtime( $dir . 'assets/three-mice.css' )
	);

	wp_enqueue_script(
		'three-mice',
		$url . 'assets/three-mice.js',
		array(),
		(string) filemtime( $dir . 'assets/three-mice.js' ),
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);
}
add_action( 'wp_enqueue_scripts', 'three_mice_enqueue_assets' );

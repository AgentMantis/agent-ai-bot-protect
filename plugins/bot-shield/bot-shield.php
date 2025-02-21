<?php
/*
Plugin Name: Bot Shield
Description: Block AI bots by managing user agents and access patterns
Version: 1.0.0
Author: Your Name
*/

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Enqueue Angular scripts and styles
function bot_shield_enqueue_scripts() {
    // Only load on our admin page
    if (isset($_GET['page']) && $_GET['page'] === 'bot-shield') {
        $plugin_dir_url = plugin_dir_url(__FILE__);
        
        // Remove default script tags - we'll add them manually with type="module"
        remove_action('wp_head', 'wp_print_scripts');
        remove_action('wp_head', 'wp_print_head_scripts', 9);
        remove_action('wp_head', 'wp_enqueue_scripts', 1);

        // Add our scripts to footer with proper type="module"
        add_action('admin_footer', function() use ($plugin_dir_url) {
            ?>
            <!-- <script type="module" src="<?php echo $plugin_dir_url; ?>dist/browser/polyfills.js?ver=1.0.0"></script> -->
            <script type="module" src="<?php echo $plugin_dir_url; ?>dist/bot-shield.js?ver=1.0.0"></script>
            <?php
        });

        // Enqueue the styles normally
        wp_enqueue_style(
            'bot-shield-styles', 
            $plugin_dir_url . 'dist/bot-shield.css', 
            [], 
            '1.0.0'
        );
    }
}
add_action('admin_enqueue_scripts', 'bot_shield_enqueue_scripts');

// Add settings link to plugins page
function bot_shield_add_settings_link($links) {
    $settings_link = '<a href="admin.php?page=bot-shield">Settings</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_bot-shield/bot-shield.php', 'bot_shield_add_settings_link');

// Add menu item
function bot_shield_add_admin_menu() {
    add_menu_page(
        'Bot Shield',         // Page title
        'Bot Shield',         // Menu title
        'manage_options',         // Capability
        'bot-shield',             // Menu slug
        function() {              // Callback function
            ?>
            <div class="wrap mat-typography">
                <bot-shield></bot-shield>
            </div>
            <?php
        },
        'dashicons-shield',       // Icon
        30                        // Position
    );
}
add_action('admin_menu', 'bot_shield_add_admin_menu'); 
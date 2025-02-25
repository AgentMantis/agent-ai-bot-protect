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
    $plugin_dir_url = plugin_dir_url(__FILE__);

    // Check if we're NOT in admin
    if (!is_admin()) {
        // Add immediate capture of critical data
        add_action('wp_head', function() {
            ?>
            <script>
                // Create temporary storage for initial page load data
                window._botShieldInitialData = {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().getTime(),
                    referrer: document.referrer
                    // Add any other critical initial data you need
                };
            </script>
            <?php
        }, 1);

        // Enqueue main analytics script
        wp_enqueue_script(
            'bot-shield-analytics',
            $plugin_dir_url . 'bot-shield-analytics.js',
            array(), 
            '1.0.0',
            true 
        );
        
        // Add async attribute to the script
        add_filter('script_loader_tag', function($tag, $handle) {
            if ('bot-shield-analytics' === $handle) {
                return str_replace(' src', ' async src', $tag);
            }
            return $tag;
        }, 10, 2);
    }

    // Only load admin-specific scripts on our admin page
    if (isset($_GET['page']) && $_GET['page'] === 'bot-shield') {
        // Remove default script tags - we'll add them manually with type="module"
        remove_action('wp_head', 'wp_print_scripts');
        remove_action('wp_head', 'wp_print_head_scripts', 9);
        remove_action('wp_head', 'wp_enqueue_scripts', 1);

        // Add our scripts to footer with proper type="module"
        add_action('admin_footer', function() use ($plugin_dir_url) {
            ?>
            <script>
                // Add REST API nonce to window object
                window.wpRestNonce = '<?php echo wp_create_nonce('wp_rest'); ?>';
            </script>
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

// Hook into both admin and frontend script enqueueing
add_action('admin_enqueue_scripts', 'bot_shield_enqueue_scripts');
add_action('wp_enqueue_scripts', 'bot_shield_enqueue_scripts');

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
        'manage_options',     // Capability
        'bot-shield',         // Menu slug
        function() {          // Callback function
            ?>
            <div class="wrap mat-typography">
                <bot-shield></bot-shield>
            </div>
            <?php
        },
        plugin_dir_url(__FILE__) . 'dist/assets/botshieldus-icon.svg', // Path to your SVG or image
        30                    // Position
    );
}
add_action('admin_menu', 'bot_shield_add_admin_menu');

// Add REST API endpoint for saving robots.txt
function bot_shield_register_routes() {
    register_rest_route('bot-shield/v1', '/save-robots-txt', [
        'methods' => 'POST',
        'callback' => 'bot_shield_save_robots_txt',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);

    // New endpoint for log analysis
    register_rest_route('bot-shield/v1', '/analyze-logs', [
        'methods' => 'GET',
        'callback' => 'bot_shield_analyze_logs',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);

    // Add this to your bot_shield_register_routes function
    register_rest_route('bot-shield/v1', '/log-visit', [
        'methods' => 'POST',
        'callback' => 'bot_shield_log_visit',
        'permission_callback' => '__return_true', // Allow public access
        'args' => [
            'userAgent' => [
                'required' => true,
                'type' => 'string'
            ],
            'timestamp' => [
                'required' => true
            ],
            'referrer' => [
                'required' => false,
                'type' => 'string'
            ],
            'url' => [
                'required' => true,
                'type' => 'string'
            ]
        ]
    ]);
}
add_action('rest_api_init', 'bot_shield_register_routes');

// Handle saving robots.txt file
function bot_shield_save_robots_txt($request) {
    $content = $request->get_param('content');
    
    // Debug logging
    error_log('Bot Shield: Received request params - content: ' . var_export($content, true));
    
    // Get path to robots.txt
    $robots_path = ABSPATH . 'robots.txt';
    
    // Read existing content
    $existing_content = '';
    if (file_exists($robots_path)) {
        $existing_content = file_get_contents($robots_path);
    }

    // Remove old BotShield section if it exists
    $pattern = '/# Begin BotShield.*# End BotShield\n*/s';
    $existing_content = preg_replace($pattern, '', $existing_content);

    // If content is empty, just save without BotShield section
    if (empty($content)) {
        $final_content = trim($existing_content) . "\n";
        error_log('Bot Shield: Clearing BotShield section. Final content: ' . var_export($final_content, true));
    } else {
        // Prepare new BotShield section
        $new_section = "# Begin BotShield\n";
        $new_section .= $content . "\n";
        $new_section .= "# End BotShield\n";

        // Combine content
        $final_content = trim($existing_content . "\n" . $new_section) . "\n";
    }

    // Write the file
    $result = file_put_contents($robots_path, $final_content);
    
    if ($result === false) {
        error_log('Bot Shield: Failed to write robots.txt file');
        return new WP_Error('write_failed', 'Failed to write robots.txt file', ['status' => 500]);
    }

    return [
        'success' => true,
        'message' => 'robots.txt file updated successfully',
        'bytes_written' => $result,
        'final_content' => $final_content
    ];
}

// Register REST API endpoints
add_action('rest_api_init', function () {
    register_rest_route('bot-shield/v1', '/analyze-logs', array(
        'methods' => 'GET',
        'callback' => 'bot_shield_analyze_logs',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        }
    ));
});

function bot_shield_analyze_logs() {
    // Get access to WordPress database
    global $wpdb;
    
    // Query to get total requests (last 30 days)
    $total_requests = $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}bot_shield_logs 
         WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    // Query to get bot requests
    $bot_requests = $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    // Query to get detected bots and their counts
    $detected_bots = $wpdb->get_results(
        "SELECT bot_name, COUNT(*) as count 
         FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY bot_name"
    );

    // Query to get recent bot visits
    $recent_visits = $wpdb->get_results(
        "SELECT bot_name as bot, timestamp as time, user_agent 
         FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 
         ORDER BY timestamp DESC 
         LIMIT 10"
    );

    // Format the response
    $response = array(
        'success' => true,
        'data' => array(
            'total_requests' => (int)$total_requests,
            'bot_requests' => (int)$bot_requests,
            'detected_bots' => array_reduce($detected_bots, function($carry, $item) {
                $carry[$item->bot_name] = (int)$item->count;
                return $carry;
            }, array()),
            'recent_bot_visits' => array_map(function($visit) {
                return array(
                    'bot' => $visit->bot,
                    'time' => $visit->time,
                    'user_agent' => $visit->user_agent
                );
            }, $recent_visits)
        )
    );

    return rest_ensure_response($response);
}

// Add this function to handle the logging
function bot_shield_log_visit($request) {
    global $wpdb;
    
    $data = $request->get_params();
    
    // Basic bot detection (you can make this more sophisticated)
    $is_bot = preg_match('/bot|crawl|spider|slurp|search|agent/i', $data['userAgent']) ? 1 : 0;
    
    // Insert into your logs table
    $result = $wpdb->insert(
        $wpdb->prefix . 'bot_shield_logs',
        [
            'user_agent' => $data['userAgent'],
            'timestamp' => date('Y-m-d H:i:s', $data['timestamp'] / 1000),
            'referrer' => $data['referrer'],
            'url' => $data['url'],
            'is_bot' => $is_bot,
            'bot_name' => $is_bot ? extract_bot_name($data['userAgent']) : null,
            // Add additional fields as needed
        ],
        ['%s', '%s', '%s', '%s', '%d', '%s']
    );

    return rest_ensure_response([
        'success' => ($result !== false),
        'is_bot' => $is_bot
    ]);
}

// Helper function to extract bot name
function extract_bot_name($user_agent) {
    if (preg_match('/(?:bot|crawl|slurp|spider|search|agent)(?:\s*|\/)([^\s;)]*)/i', $user_agent, $matches)) {
        return $matches[1] ?: 'Unknown Bot';
    }
    return 'Unknown Bot';
}

// Add this new function to handle CORS
function bot_shield_add_cors_headers() {
    header('Access-Control-Allow-Origin: ' . esc_url_raw(site_url()));
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
    
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        status_header(200);
        exit();
    }
}
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', 'bot_shield_add_cors_headers');
}, 15);

function bot_shield_admin_styles() {
    echo '
    <style>
        #toplevel_page_bot-shield .wp-menu-image img {
            height: 25px;
            padding: 0px;
            margin-top: 3px;
            margin-left: 8px;
        }
    </style>
    ';
}
add_action('admin_head', 'bot_shield_admin_styles'); 
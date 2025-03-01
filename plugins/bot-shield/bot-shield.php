<?php
/*
Plugin Name: Bot Shield
Description: Block AI bots by managing user agents and access patterns
Version: 1.0.0
Author: Your Name
*/

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Create database tables on plugin activation
function bot_shield_activate() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    
    $table_name = $wpdb->prefix . 'bot_shield_logs';
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_agent text NOT NULL,
        timestamp datetime NOT NULL,
        referrer text,
        url text NOT NULL,
        is_bot tinyint(1) NOT NULL DEFAULT 0,
        bot_name varchar(255),
        is_blocked tinyint(1) NOT NULL DEFAULT 0,
        PRIMARY KEY  (id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    // Set version in options
    update_option('bot_shield_db_version', '1.1');
}
register_activation_hook(__FILE__, 'bot_shield_activate');

// Check and update database structure
function bot_shield_check_db_updates() {
    $current_version = get_option('bot_shield_db_version', '1.0');
    
    // If we're already at the latest version, no need to continue
    if (version_compare($current_version, '1.1', '>=')) {
        return;
    }
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'bot_shield_logs';
    
    // Check if the table exists
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table_name'") === $table_name;
    
    if ($table_exists) {
        // Check if is_blocked column exists
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $table_name LIKE 'is_blocked'");
        
        if (empty($column_exists)) {
            // Add the is_blocked column
            $wpdb->query("ALTER TABLE $table_name ADD COLUMN is_blocked tinyint(1) NOT NULL DEFAULT 0");
        }
    }
    
    // Update version
    update_option('bot_shield_db_version', '1.1');
}
add_action('plugins_loaded', 'bot_shield_check_db_updates');

// Extract disallowed bots from robots.txt
function bot_shield_get_disallowed_bots() {
    $robots_txt_content = get_option('bot_shield_robots_txt', '');
    $disallowed_bots = array();
    
    // Extract bot names from User-agent lines
    if (!empty($robots_txt_content)) {
        $lines = explode("\n", $robots_txt_content);
        $current_bot = null;
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            // Skip comments and empty lines
            if (empty($line) || strpos($line, '#') === 0) {
                continue;
            }
            
            // Check for User-agent lines
            if (preg_match('/^User-agent:\s*(.+)$/i', $line, $matches)) {
                $current_bot = trim($matches[1]);
                
                // Skip the wildcard user agent
                if ($current_bot !== '*') {
                    $disallowed_bots[] = $current_bot;
                }
            }
        }
    }
    
    return $disallowed_bots;
}

// Check and block disallowed bots
function bot_shield_check_and_block() {
    // Skip for admin users
    if (is_admin() || current_user_can('manage_options')) {
        return;
    }
    
    // Check if blocking is enabled
    $blocking_enabled = get_option('bot_shield_blocking_enabled', '1') === '1';
    
    // Get user agent
    $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
    if (empty($user_agent)) {
        return;
    }
    
    // Get disallowed bots
    $disallowed_bots = bot_shield_get_disallowed_bots();
    
    // Check if current user agent matches any disallowed bot
    foreach ($disallowed_bots as $bot) {
        // Check for exact match or if the bot name is contained in the user agent
        if (stripos($user_agent, $bot) !== false) {
            // Log the blocked request
            global $wpdb;
            $wpdb->insert(
                $wpdb->prefix . 'bot_shield_logs',
                [
                    'user_agent' => $user_agent,
                    'timestamp' => current_time('mysql'),
                    'referrer' => isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '',
                    'url' => (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]",
                    'is_bot' => 1,
                    'bot_name' => $bot,
                    'is_blocked' => $blocking_enabled ? 1 : 0
                ],
                ['%s', '%s', '%s', '%s', '%d', '%s', '%d']
            );
            
            // Only block if blocking is enabled
            if ($blocking_enabled) {
                // Send 403 Forbidden response
                status_header(403);
                nocache_headers();
                echo '<html><head><title>403 Forbidden</title></head><body>';
                echo '<h1>403 Forbidden</h1>';
                echo '<p>Access to this resource is denied by Bot Shield.</p>';
                echo '</body></html>';
                exit;
            }
        }
    }
}

// Hook into WordPress init to check and block bots
add_action('init', 'bot_shield_check_and_block', 1);

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
    
    // Add endpoint to toggle bot blocking
    register_rest_route('bot-shield/v1', '/toggle-blocking', [
        'methods' => 'POST',
        'callback' => 'bot_shield_toggle_blocking',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => [
            'enabled' => [
                'required' => true,
                'type' => 'boolean'
            ]
        ]
    ]);
    
    // Add endpoint to get blocking status
    register_rest_route('bot-shield/v1', '/blocking-status', [
        'methods' => 'GET',
        'callback' => 'bot_shield_get_blocking_status',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
}
add_action('rest_api_init', 'bot_shield_register_routes');

// Handle saving robots.txt file
function bot_shield_save_robots_txt($request) {
    $content = $request->get_param('content');
    
    // Debug logging
    error_log('Bot Shield: Received request params - content: ' . var_export($content, true));
    
    // Read existing content
    $existing_content = get_option('bot_shield_robots_txt', '');
    if (empty($existing_content)) {
        // Default robots.txt content if none exists
        $existing_content = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n";
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

    // Save the final content to WordPress option
    update_option('bot_shield_robots_txt', $final_content);

    // Return the final content
    return [
        'success' => true,
        'message' => 'robots.txt file updated successfully',
        'final_content' => $final_content
    ];
}

// Add this function to serve the robots.txt content
function bot_shield_serve_robots_txt($robots_txt, $public = 1) {
    $custom_content = get_option('bot_shield_robots_txt');
    if (!empty($custom_content)) {
        return $custom_content;
    }
    return $robots_txt;
}
add_filter('robots_txt', 'bot_shield_serve_robots_txt');

// Analyze logs
function bot_shield_analyze_logs() {
    global $wpdb;
    
    $total_requests = $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}bot_shield_logs 
         WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    $bot_requests = $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    
    $blocked_requests = $wpdb->get_var(
        "SELECT COUNT(*) FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_blocked = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );

    $detected_bots = $wpdb->get_results(
        "SELECT bot_name, COUNT(*) as count, SUM(is_blocked) as blocked_count 
         FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY bot_name"
    );

    $recent_visits = $wpdb->get_results(
        "SELECT bot_name as bot, timestamp as time, user_agent, is_blocked 
         FROM {$wpdb->prefix}bot_shield_logs 
         WHERE is_bot = 1 
         ORDER BY timestamp DESC 
         LIMIT 10"
    );

    $response = array(
        'success' => true,
        'data' => array(
            'total_requests' => (int)$total_requests,
            'bot_requests' => (int)$bot_requests,
            'blocked_requests' => (int)$blocked_requests,
            'detected_bots' => array_reduce($detected_bots, function($carry, $item) {
                $carry[$item->bot_name] = array(
                    'total' => (int)$item->count,
                    'blocked' => (int)$item->blocked_count
                );
                return $carry;
            }, array()),
            'recent_bot_visits' => array_map(function($visit) {
                return array(
                    'bot' => $visit->bot,
                    'time' => $visit->time,
                    'user_agent' => $visit->user_agent,
                    'blocked' => (bool)$visit->is_blocked
                );
            }, $recent_visits)
        )
    );

    return rest_ensure_response($response);
}

// Log visit
function bot_shield_log_visit($request) {
    global $wpdb;
    
    $data = $request->get_params();
    
    $is_bot = preg_match('/bot|crawl|spider|slurp|search|agent/i', $data['userAgent']) ? 1 : 0;
    
    $result = $wpdb->insert(
        $wpdb->prefix . 'bot_shield_logs',
        [
            'user_agent' => $data['userAgent'],
            'timestamp' => date('Y-m-d H:i:s', $data['timestamp'] / 1000),
            'referrer' => $data['referrer'],
            'url' => $data['url'],
            'is_bot' => $is_bot,
            'bot_name' => $is_bot ? extract_bot_name($data['userAgent']) : null,
        ],
        ['%s', '%s', '%s', '%s', '%d', '%s']
    );

    return rest_ensure_response([
        'success' => ($result !== false),
        'is_bot' => $is_bot
    ]);
}

// Extract bot name
function extract_bot_name($user_agent) {
    if (preg_match('/(?:bot|crawl|slurp|spider|search|agent)(?:\s*|\/)([^\s;)]*)/i', $user_agent, $matches)) {
        return $matches[1] ?: 'Unknown Bot';
    }
    return 'Unknown Bot';
}

// Add CORS headers
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

// Toggle bot blocking
function bot_shield_toggle_blocking($request) {
    $enabled = $request->get_param('enabled');
    update_option('bot_shield_blocking_enabled', $enabled ? '1' : '0');
    
    return rest_ensure_response([
        'success' => true,
        'enabled' => $enabled
    ]);
}

// Get blocking status
function bot_shield_get_blocking_status() {
    $enabled = get_option('bot_shield_blocking_enabled', '1');
    
    return rest_ensure_response([
        'success' => true,
        'enabled' => $enabled === '1'
    ]);
} 
<?php
/*
Plugin Name: Agent AI Bot Protect
Description: Block AI bots by managing user agents and access patterns
Version: 1.0.0
Author: Agent Mantis
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
*/

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

// Create database tables on plugin activation
function agent_ai_bot_protect_activate() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
 
    
    // Create the agent_ai_bot_protect_counts table for aggregated data
    $counts_table = $wpdb->prefix . 'agent_ai_bot_protect_counts';
    $counts_sql = "CREATE TABLE IF NOT EXISTS $counts_table (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        bot_name varchar(255) NOT NULL,
        date_recorded date NOT NULL,
        hit_count int NOT NULL DEFAULT 1,
        blocked_count int NOT NULL DEFAULT 0,
        PRIMARY KEY  (id),
        UNIQUE KEY bot_date (bot_name, date_recorded)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($counts_sql);
    // Set version in options
    update_option('agent_ai_bot_protect_db_version', '1.2');
}
register_activation_hook(__FILE__, 'agent_ai_bot_protect_activate');

// Check and update database structure
function agent_ai_bot_protect_check_db_updates() {
    $current_version = get_option('agent_ai_bot_protect_db_version', '1.0');
    
    // If we're already at the latest version, no need to continue
    if (version_compare($current_version, '1.2', '>=')) {
        return;
    }
    
    global $wpdb;
    
    // Update from 1.0 to 1.1 (add is_blocked column)
    if (version_compare($current_version, '1.1', '<')) {
        $table_name = $wpdb->prefix . 'agent_ai_bot_protect_logs';
        
        // Check if the table exists
        // Direct DB query is necessary here for schema operations that WordPress doesn't provide abstracted functions for
        // Using caching to avoid repeated queries
        $cache_key = 'agent_ai_bot_protect_table_exists_' . $table_name;
        $table_exists = wp_cache_get($cache_key);
        
        if (false === $table_exists) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Schema check requires direct query
            $table_exists = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $table_name)) === $table_name;
            wp_cache_set($cache_key, $table_exists, '', 3600); // Cache for 1 hour
        }
        
        if ($table_exists) {
            // Check if is_blocked column exists
            // Direct DB query is necessary for schema inspection
            $column_cache_key = 'agent_ai_bot_protect_column_exists_is_blocked_' . $table_name;
            $column_exists = wp_cache_get($column_cache_key);
            
            if (false === $column_exists) {
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Schema check requires direct query
                $column_exists = $wpdb->get_results(
                    $wpdb->prepare(
                        "SHOW COLUMNS FROM {$wpdb->prefix}agent_ai_bot_protect_logs LIKE %s", 
                        'is_blocked'
                    )
                );
                wp_cache_set($column_cache_key, $column_exists, '', 3600); // Cache for 1 hour
            }
            
            if (empty($column_exists)) {
                // Add the is_blocked column using dbDelta which is WordPress' recommended way to handle schema changes
                require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
                
                // Create a temporary table definition that includes the new column
                $charset_collate = $wpdb->get_charset_collate();
                $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
                    id bigint(20) NOT NULL AUTO_INCREMENT,
                    user_agent text NOT NULL,
                    accessed_url varchar(255) NOT NULL,
                    timestamp datetime NOT NULL,
                    is_blocked tinyint(1) NOT NULL DEFAULT 0,
                    PRIMARY KEY  (id)
                ) $charset_collate;";
                
                // Use dbDelta to add the column
                dbDelta($sql);
                
                // Invalidate the cache since we modified the schema
                wp_cache_delete($column_cache_key);
            }
        }
    }
    
    // Update from 1.1 to 1.2 (add counts table)
    if (version_compare($current_version, '1.2', '<')) {
        $counts_table = $wpdb->prefix . 'agent_ai_bot_protect_counts';
        $charset_collate = $wpdb->get_charset_collate();
        
        $counts_sql = "CREATE TABLE IF NOT EXISTS $counts_table (
            id bigint(20) NOT NULL AUTO_INCREMENT,
            bot_name varchar(255) NOT NULL,
            date_recorded date NOT NULL,
            hit_count int NOT NULL DEFAULT 1,
            blocked_count int NOT NULL DEFAULT 0,
            PRIMARY KEY  (id),
            UNIQUE KEY bot_date (bot_name, date_recorded)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($counts_sql);
    }
    
    // Update version
    update_option('agent_ai_bot_protect_db_version', '1.2');
}
add_action('plugins_loaded', 'agent_ai_bot_protect_check_db_updates');


// Extract disallowed bots from robots.txt
function agent_ai_bot_protect_get_disallowed_bots() {
    $robots_txt_content = get_option('agent_ai_bot_protect_robots_txt', '');
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
function agent_ai_bot_protect_check_and_block() {
    // Skip for admin users
    if (is_admin() || current_user_can('manage_options')) {
        return;
    }
    
    // Check if blocking is enabled
    $blocking_enabled = get_option('agent_ai_bot_protect_blocking_enabled', '1') === '1';
    
    // Get user agent
    $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '';
    if (empty($user_agent)) {
        return;
    }
    
    // Get bots from plugin's robots.txt file (for tracking only)
    $plugin_robots_txt_path = plugin_dir_path(__FILE__) . 'dist/assets/robots.txt';
    $known_bots = array();
    
    if (file_exists($plugin_robots_txt_path)) {
        $robots_content = file_get_contents($plugin_robots_txt_path);
        $lines = explode("\n", $robots_content);
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            // Skip empty lines and disallow directives
            if (empty($line) || strpos($line, 'Disallow:') === 0) {
                continue;
            }
            
            // Extract bot name from User-agent line
            if (preg_match('/^User-agent:\s*(.+)$/i', $line, $matches)) {
                $bot_name = trim($matches[1]);
                
                // Skip the wildcard user agent
                if ($bot_name !== '*') {
                    $known_bots[] = $bot_name;
                }
            }
        }
    }
    
    // Get disallowed bots from site's robots.txt (via WordPress option) - these will be blocked
    $disallowed_bots = agent_ai_bot_protect_get_disallowed_bots();
    
    // Flag to track if we've already counted this bot
    $bot_counted = false;
    $matched_bot_name = '';
    
    // First check if the user agent matches any disallowed bot from the site's robots.txt (for blocking)
    if ($blocking_enabled) {
        foreach ($disallowed_bots as $bot) {
            if (stripos($user_agent, $bot) !== false) {
                // Log the bot hit and mark as blocked
                agent_ai_bot_protect_increment_bot_count($bot, true);
                $bot_counted = true;
                $matched_bot_name = $bot;
                
                // Send 403 Forbidden response
                status_header(403);
                nocache_headers();
                echo '<html><head><title>' . esc_html__('403 Forbidden', 'agent-ai-bot-protect') . '</title></head><body>';
                echo '<h1>' . esc_html__('403 Forbidden', 'agent-ai-bot-protect') . '</h1>';
                echo '<p>' . esc_html__('Access to this resource is denied by Agent AI Bot Protect.', 'agent-ai-bot-protect') . '</p>';
                echo '</body></html>';
                exit;
            }
        }
    }
    
    // If not already counted as a disallowed bot, check if it matches any known bot from the plugin's list
    if (!$bot_counted) {
        foreach ($known_bots as $bot) {
            if (stripos($user_agent, $bot) !== false) {
                // Log the bot hit (increment counter) but don't block
                agent_ai_bot_protect_increment_bot_count($bot, false);
                break; // Only count once if multiple patterns match
            }
        }
    }
}

// Increment bot count
function agent_ai_bot_protect_increment_bot_count($bot_name, $was_blocked = false) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'agent_ai_bot_protect_counts';
    $today = current_time('Y-m-d');
    
    // Direct DB queries are necessary here for performance reasons when tracking bot hits
    // We're using a custom table structure optimized for aggregating bot statistics
    // Using a transient-based locking mechanism to prevent race conditions on high-traffic sites
    $lock_key = 'agent_ai_bot_protect_lock_' . md5($bot_name . $today);
    
    // Try to get the lock
    if (get_transient($lock_key)) {
        // Another process is updating this record, wait a moment and try again
        usleep(100000); // Wait 100ms
        agent_ai_bot_protect_increment_bot_count($bot_name, $was_blocked);
        return;
    }
    
    // Set a short lock to prevent race conditions
    set_transient($lock_key, true, 5); // 5 second lock
    
    try {
        // Cache key for this specific bot and date
        $cache_key = 'agent_ai_bot_protect_bot_' . md5($bot_name . $today);
        $record_exists = wp_cache_get($cache_key);
        
        // Try to update existing record for today
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct query needed for atomic counter increment with proper caching implemented
        $result = $wpdb->query(
            $wpdb->prepare(
                "UPDATE {$wpdb->prefix}agent_ai_bot_protect_counts
                 SET hit_count = hit_count + 1,
                    blocked_count = blocked_count + %d
                 WHERE bot_name = %s AND date_recorded = %s",
                $was_blocked ? 1 : 0,
                $bot_name,
                $today
            )
        );
        
        // If no record was updated, insert a new one
        if ($result === 0) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Insert operation requires direct query
            $wpdb->insert(
                $table_name,
                [
                    'bot_name' => $bot_name,
                    'date_recorded' => $today,
                    'hit_count' => 1,
                    'blocked_count' => $was_blocked ? 1 : 0
                ],
                ['%s', '%s', '%d', '%d']
            );
            // Set cache to indicate this record now exists
            wp_cache_set($cache_key, true, '', 3600); // Cache for 1 hour
        }
    } finally {
        // Always release the lock
        delete_transient($lock_key);
    }
}

// Hook into WordPress init to check and block bots
add_action('init', 'agent_ai_bot_protect_check_and_block', 1);

// Enqueue Angular scripts and styles
function agent_ai_bot_protect_enqueue_scripts() {
    $plugin_dir_url = plugin_dir_url(__FILE__);

    // Check if we're NOT in admin
    if (!is_admin()) {
        // Register and enqueue main analytics script
        wp_register_script(
            'tracking-agent',
            $plugin_dir_url . 'tracking-agent.js',
            array(), 
            '1.0.0',
            true 
        );
        
        // Add initial data capture script
        wp_add_inline_script(
            'tracking-agent',
            'window._botShieldInitialData = {
                userAgent: navigator.userAgent,
                timestamp: new Date().getTime(),
                referrer: document.referrer
                // Add any other critical initial data you need
            };',
            'before'
        );
        
        // Enqueue the script
        wp_enqueue_script('tracking-agent');
        
        // Add async attribute to the script
        add_filter('script_loader_tag', function($tag, $handle) {
            if ('tracking-agent' === $handle) {
                return str_replace(' src', ' async src', $tag);
            }
            return $tag;
        }, 10, 2);
    }

    // Only load admin-specific scripts on our admin page
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- No action is taken here, just checking page for script loading
    if (is_admin() && isset($_GET['page']) && 'agent-ai-bot-protect' === sanitize_key(wp_unslash($_GET['page']))) {
        // This is only used to determine which script to load on admin pages
        // No sensitive operation is performed based on this value, just script enqueueing
        // Additionally, it's protected by the 'manage_options' capability requirement
        
        // Enqueue the module script
        wp_enqueue_script(
            'agent-ai-bot-protect-module',
            $plugin_dir_url . 'dist/agent-ai-bot-protect.js',
            array(),
            '1.0.0',
            true
        );
        
        // Add the module type to the script tag
        add_filter('script_loader_tag', function($tag, $handle) {
            if ('agent-ai-bot-protect-module' === $handle) {
                return str_replace(' src', ' type="module" src', $tag);
            }
            return $tag;
        }, 10, 2);
        
        // Add the REST API nonce to the script
        wp_localize_script(
            'agent-ai-bot-protect-module',
            'AgentAIBotProtectData',
            array(
                'wpRestNonce' => wp_create_nonce('wp_rest')
            )
        );

        // Enqueue the styles normally
        wp_enqueue_style(
            'agent-ai-bot-protect-styles', 
            $plugin_dir_url . 'dist/agent-ai-bot-protect.css', 
            [], 
            '1.0.0'
        );
    }
}

// Hook into both admin and frontend script enqueueing
add_action('admin_enqueue_scripts', 'agent_ai_bot_protect_enqueue_scripts');
add_action('wp_enqueue_scripts', 'agent_ai_bot_protect_enqueue_scripts');

// Add settings link to plugins page
function agent_ai_bot_protect_add_settings_link($links) {
    $settings_link = '<a href="admin.php?page=agent-ai-bot-protect">Settings</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_agent-ai-bot-protect/agent-ai-bot-protect.php', 'agent_ai_bot_protect_add_settings_link');

// Add menu item
function agent_ai_bot_protect_add_admin_menu() {
    add_menu_page(
        'Agent AI Bot Protect',         // Page title
        'Agent AI Bot Protect',         // Menu title
        'manage_options',     // Capability
        'agent-ai-bot-protect',         // Menu slug
        function() {          // Callback function
            // This is an admin page that only users with manage_options capability can access
            // We're just checking if page=agent-ai-bot-protect in the URL to determine which admin page to load
            // No form submission is being processed here, just loading the Angular app
            ?>
            <div class="wrap mat-typography">
                <agent-ai-bot-protect></agent-ai-bot-protect>
            </div>
            <?php
        },
        plugin_dir_url(__FILE__) . 'dist/assets/icon.svg', // Path to your SVG or image
        30                    // Position
    );
}
add_action('admin_menu', 'agent_ai_bot_protect_add_admin_menu');

// Add REST API endpoint for saving robots.txt
function agent_ai_bot_protect_register_routes() {
    register_rest_route('agent-ai-bot-protect/v1', '/save-robots-txt', [
        'methods' => 'POST',
        'callback' => 'agent_ai_bot_protect_save_robots_txt',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);

    // New endpoint for log analysis
    register_rest_route('agent-ai-bot-protect/v1', '/analyze-logs', [
        'methods' => 'GET',
        'callback' => 'agent_ai_bot_protect_analyze_logs',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
    
    // Add endpoint for getting bot stats by date range
    register_rest_route('agent-ai-bot-protect/v1', '/bot-stats', [
        'methods' => 'GET',
        'callback' => 'agent_ai_bot_protect_get_stats',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => [
            'start_date' => [
                'required' => false,
                'type' => 'string'
            ],
            'end_date' => [
                'required' => false,
                'type' => 'string'
            ]
        ]
    ]);

    // Add this to your agent_ai_bot_protect_register_routes function
    register_rest_route('agent-ai-bot-protect/v1', '/log-visit', [
        'methods' => 'POST',
        'callback' => 'agent_ai_bot_protect_log_visit',
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
    register_rest_route('agent-ai-bot-protect/v1', '/toggle-blocking', [
        'methods' => 'POST',
        'callback' => 'agent_ai_bot_protect_toggle_blocking',
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
    register_rest_route('agent-ai-bot-protect/v1', '/blocking-status', [
        'methods' => 'GET',
        'callback' => 'agent_ai_bot_protect_get_blocking_status',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);

    // Add endpoint for robots.txt URL management
    register_rest_route('agent-ai-bot-protect/v1', '/robots-txt-url', [
        'methods' => 'GET',
        'callback' => 'agent_ai_bot_protect_get_robots_txt_url',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);

    register_rest_route('agent-ai-bot-protect/v1', '/robots-txt-url', [
        'methods' => 'POST',
        'callback' => 'agent_ai_bot_protect_save_robots_txt_url',
        'permission_callback' => function() {
            return current_user_can('manage_options');
        },
        'args' => [
            'url' => [
                'required' => true,
                'type' => 'string'
            ]
        ]
    ]);
}
add_action('rest_api_init', 'agent_ai_bot_protect_register_routes');

// Handle saving robots.txt file
function agent_ai_bot_protect_save_robots_txt($request) {
    // Get content parameter and ensure it's a string
    $content = $request->get_param('content');
    $content = is_null($content) ? '' : sanitize_textarea_field((string)$content);
    
    // Check if we should clear the BotShield section
    $clear = $request->get_param('clear');
    $should_clear = !empty($clear);
    
    // Debug logging
    
    
    // Read existing content
    $existing_content = get_option('agent_ai_bot_protect_robots_txt', '');
    if (empty($existing_content)) {
        // Default robots.txt content if none exists
        $existing_content = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n";
    }

    // Remove old BotShield section if it exists
    $pattern = '/# Begin BotShield.*# End BotShield\n*/s';
    $existing_content = preg_replace($pattern, '', $existing_content);

    // If content is empty or clear is true, just save without BotShield section
    if (empty($content) || $should_clear) {
        $final_content = trim($existing_content) . "\n";
        
    } else {
        // Prepare new BotShield section
        $new_section = "# Begin BotShield\n";
        $new_section .= $content . "\n";
        $new_section .= "# End BotShield\n";

        // Combine content
        $final_content = trim($existing_content . "\n" . $new_section) . "\n";
    }

    // Save the final content to WordPress option
    update_option('agent_ai_bot_protect_robots_txt', $final_content);

    // Return the final content
    return [
        'success' => true,
        'message' => 'robots.txt file updated successfully',
        'final_content' => $final_content
    ];
}

// Add this function to serve the robots.txt content
function agent_ai_bot_protect_serve_robots_txt($robots_txt, $public = 1) {
    $custom_content = get_option('agent_ai_bot_protect_robots_txt');
    if (!empty($custom_content)) {
        return $custom_content;
    }
    return $robots_txt;
}
add_filter('robots_txt', 'agent_ai_bot_protect_serve_robots_txt');

// Analyze logs
function agent_ai_bot_protect_analyze_logs() {
    global $wpdb;
    $counts_table = $wpdb->prefix . 'agent_ai_bot_protect_counts';
    
    // Direct DB queries are necessary here for complex aggregation queries on custom tables
    // We're implementing caching to improve performance
    
    // Cache key for the entire analytics response
    $cache_key = 'agent_ai_bot_protect_analytics_30days';
    $cached_response = wp_cache_get($cache_key);
    
    if (false !== $cached_response) {
        return rest_ensure_response(maybe_unserialize($cached_response));
    }
    
    // Get total hits and blocks for the last 30 days
    $stats_cache_key = 'agent_ai_bot_protect_stats_totals_30days';
    $stats = wp_cache_get($stats_cache_key);
    
    if (false === $stats) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Analytics query with proper caching
        $stats = $wpdb->get_row(
            "SELECT SUM(hit_count) as total_hits, SUM(blocked_count) as total_blocks
             FROM {$wpdb->prefix}agent_ai_bot_protect_counts 
             WHERE date_recorded >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
        );
        wp_cache_set($stats_cache_key, $stats, '', 3600); // Cache for 1 hour
    }
    
    $total_hits = $stats ? (int)$stats->total_hits : 0;
    $total_blocks = $stats ? (int)$stats->total_blocks : 0;
    
    // Get bot-specific stats
    $bot_stats_cache_key = 'agent_ai_bot_protect_bot_stats_30days';
    $bot_stats = wp_cache_get($bot_stats_cache_key);
    
    if (false === $bot_stats) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Analytics query with proper caching
        $bot_stats = $wpdb->get_results(
            "SELECT bot_name, SUM(hit_count) as total, SUM(blocked_count) as blocked
             FROM {$wpdb->prefix}agent_ai_bot_protect_counts 
             WHERE date_recorded >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY bot_name
             ORDER BY total DESC"
        );
        wp_cache_set($bot_stats_cache_key, $bot_stats, '', 3600); // Cache for 1 hour
    }
    
    // Get daily stats for the last 30 days
    $daily_stats_cache_key = 'agent_ai_bot_protect_daily_stats_30days';
    $daily_stats = wp_cache_get($daily_stats_cache_key);
    
    if (false === $daily_stats) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Analytics query with proper caching
        $daily_stats = $wpdb->get_results(
            "SELECT date_recorded, SUM(hit_count) as hits, SUM(blocked_count) as blocks
             FROM {$wpdb->prefix}agent_ai_bot_protect_counts 
             WHERE date_recorded >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY date_recorded
             ORDER BY date_recorded DESC"
        );
        wp_cache_set($daily_stats_cache_key, $daily_stats, '', 3600); // Cache for 1 hour
    }
    
    $response = array(
        'success' => true,
        'data' => array(
            'total_requests' => $total_hits,
            'blocked_requests' => $total_blocks,
            'detected_bots' => array_reduce($bot_stats, function($carry, $item) {
                $carry[$item->bot_name] = array(
                    'total' => (int)$item->total,
                    'blocked' => (int)$item->blocked
                );
                return $carry;
            }, array()),
            'daily_stats' => array_map(function($day) {
                return array(
                    'date' => $day->date_recorded,
                    'hits' => (int)$day->hits,
                    'blocks' => (int)$day->blocks
                );
            }, $daily_stats)
        )
    );
    
    // Cache the entire response
    wp_cache_set($cache_key, maybe_serialize($response), '', 3600); // Cache for 1 hour

    return rest_ensure_response($response);
}

// Log visit (for client-side detection - keep for backward compatibility)
function agent_ai_bot_protect_log_visit($request) {
    $data = $request->get_params();
    
    // Sanitize the data
    $userAgent = isset($data['userAgent']) ? sanitize_text_field($data['userAgent']) : '';
    
    $is_bot = preg_match('/bot|crawl|spider|slurp|search|agent/i', $userAgent) ? 1 : 0;
    
    if ($is_bot) {
        $bot_name = extract_bot_name($userAgent);
        // Only increment count for bots
        agent_ai_bot_protect_increment_bot_count($bot_name, false);
    }
    
    return rest_ensure_response([
        'success' => true,
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
function agent_ai_bot_protect_add_cors_headers() {
    header('Access-Control-Allow-Origin: ' . esc_url_raw(site_url()));
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept');
    
    // Properly validate and unslash the REQUEST_METHOD
    if (isset($_SERVER['REQUEST_METHOD']) && sanitize_text_field(wp_unslash($_SERVER['REQUEST_METHOD'])) === 'OPTIONS') {
        status_header(200);
        exit();
    }
}
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', 'agent_ai_bot_protect_add_cors_headers');
}, 15);

function agent_ai_bot_protect_admin_styles() {
    // Register an empty stylesheet for our admin styles
    wp_register_style(
        'agent-ai-bot-protect-admin-styles',
        false,
        array(),  // No dependencies 
        '1.0.0'   // Version number
    );
    
    // Add our inline styles
    wp_add_inline_style(
        'agent-ai-bot-protect-admin-styles',
        '
        #toplevel_page_agent-ai-bot-protect .wp-menu-image img {
            height: 35px;
            padding: 0px;
            margin-top: 5px;
            margin-left: 2px;
        }
        '
    );
    
    // Enqueue the style
    wp_enqueue_style('agent-ai-bot-protect-admin-styles');
}
add_action('admin_head', 'agent_ai_bot_protect_admin_styles');

// Toggle bot blocking
function agent_ai_bot_protect_toggle_blocking($request) {
    $enabled = (bool)$request->get_param('enabled');
    update_option('agent_ai_bot_protect_blocking_enabled', $enabled ? '1' : '0');
    
    return rest_ensure_response([
        'success' => true,
        'enabled' => $enabled
    ]);
}

// Get blocking status
function agent_ai_bot_protect_get_blocking_status() {
    $enabled = get_option('agent_ai_bot_protect_blocking_enabled', '1');
    
    return rest_ensure_response([
        'success' => true,
        'enabled' => $enabled === '1'
    ]);
}

// Get bot stats by date range
function agent_ai_bot_protect_get_stats($request) {
    global $wpdb;
    $counts_table = $wpdb->prefix . 'agent_ai_bot_protect_counts';
    
    // Get date range parameters with validation
    $start_date = $request->get_param('start_date');
    $end_date = $request->get_param('end_date');
    
    // Log initial date parameters
    
    // Validate and sanitize dates
    if (!empty($start_date)) {
        $start_date = sanitize_text_field($start_date);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date)) {
            $start_date = gmdate('Y-m-d', strtotime('-30 days'));
            
        }
    } else {
        $start_date = gmdate('Y-m-d', strtotime('-30 days'));
        
    }
    
    if (!empty($end_date)) {
        $end_date = sanitize_text_field($end_date);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
            $end_date = gmdate('Y-m-d');
        
        }
    } else {
        $end_date = gmdate('Y-m-d');
        
    }
    
    // Cache key for the entire stats response for this date range
    $cache_key = 'agent_ai_bot_protect_stats_' . md5($start_date . '_' . $end_date);
    $cached_response = wp_cache_get($cache_key);
    
    if (false !== $cached_response) {
        
        return rest_ensure_response(maybe_unserialize($cached_response));
    }
    
    // Get bot stats for the date range
    $bot_stats_cache_key = 'agent_ai_bot_protect_bot_stats_' . md5($start_date . '_' . $end_date);
    $bot_stats = wp_cache_get($bot_stats_cache_key);
    
    if (false === $bot_stats) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Analytics query with proper caching
        $bot_stats = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT bot_name, SUM(hit_count) as total, SUM(blocked_count) as blocked
                 FROM {$wpdb->prefix}agent_ai_bot_protect_counts 
                 WHERE date_recorded BETWEEN %s AND %s
                 GROUP BY bot_name
                 ORDER BY total DESC",
                $start_date,
                $end_date
            )
        );
        wp_cache_set($bot_stats_cache_key, $bot_stats, '', 3600); // Cache for 1 hour
    }
    
    // Get daily stats for the date range
    $daily_stats_cache_key = 'agent_ai_bot_protect_daily_stats_' . md5($start_date . '_' . $end_date);
    $daily_stats = wp_cache_get($daily_stats_cache_key);
    
    if (false === $daily_stats) {
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Analytics query with proper caching
        $daily_stats = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT date_recorded, SUM(hit_count) as hits, SUM(blocked_count) as blocks
                 FROM {$wpdb->prefix}agent_ai_bot_protect_counts 
                 WHERE date_recorded BETWEEN %s AND %s
                 GROUP BY date_recorded
                 ORDER BY date_recorded ASC",
                $start_date,
                $end_date
            )
        );
        wp_cache_set($daily_stats_cache_key, $daily_stats, '', 3600); // Cache for 1 hour
    }
    
    // Ensure we have arrays even if no data
    $bot_stats = is_array($bot_stats) ? $bot_stats : array();
    $daily_stats = is_array($daily_stats) ? $daily_stats : array();
    
    // Process bot stats with type casting and validation
    $processed_bots = array();
    foreach ($bot_stats as $stat) {
        if (isset($stat->bot_name) && is_string($stat->bot_name)) {
            $processed_bots[$stat->bot_name] = array(
                'total' => (int)($stat->total ?? 0),
                'blocked' => (int)($stat->blocked ?? 0)
            );
        }
    }
    
    
    // Process daily stats with type casting and validation
    $processed_daily = array();
    foreach ($daily_stats as $stat) {
        if (isset($stat->date_recorded) && is_string($stat->date_recorded)) {
            $processed_daily[] = array(
                'date' => $stat->date_recorded,
                'hits' => (int)($stat->hits ?? 0),
                'blocks' => (int)($stat->blocks ?? 0)
            );
        }
    }
    
    
    $response = array(
        'success' => true,
        'data' => array(
            'start_date' => $start_date,
            'end_date' => $end_date,
            'bots' => $processed_bots,
            'daily' => $processed_daily
        )
    );
    
    // Log the final response before caching
    
    
    // Cache the entire response
    wp_cache_set($cache_key, maybe_serialize($response), '', 3600); // Cache for 1 hour
    
    return rest_ensure_response($response);
}

// Get robots.txt URL
function agent_ai_bot_protect_get_robots_txt_url() {
    $url = get_option('agent_ai_bot_protect_robots_txt_url', '');
    return rest_ensure_response(['url' => $url]);
}

// Save robots.txt URL
function agent_ai_bot_protect_save_robots_txt_url($request) {
    $url = sanitize_url($request->get_param('url'));
    if (empty($url)) {
        return new WP_Error('invalid_url', 'URL cannot be empty', ['status' => 400]);
    }

    update_option('agent_ai_bot_protect_robots_txt_url', $url);
    return rest_ensure_response(['success' => true]);
} 
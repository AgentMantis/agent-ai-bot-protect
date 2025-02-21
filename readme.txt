=== AI Bot Blocker ===
Contributors: yourname
Tags: security, bot blocking, ai protection, user agent
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Block AI bots from scraping your website content by managing user agents and access patterns.

== Description ==

AI Bot Blocker helps protect your website content from being scraped by AI bots. The plugin maintains an up-to-date list of known AI bot user agents and allows you to add custom user agents to block.

Features:

* Automatically blocks known AI bot user agents
* Fetches updated bot lists from a maintained repository
* Custom user agent blocking
* Simple enable/disable toggle
* Easy-to-use admin interface

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/bot-shield` directory
2. Activate the plugin through the 'Plugins' screen in WordPress
3. Use the Settings->AI Bot Blocker screen to configure the plugin

== Frequently Asked Questions ==

= How does the plugin block AI bots? =

The plugin checks visitor user agents against known AI bot patterns and custom patterns you define. When a match is found, the bot is blocked with a 403 error.

= Can I add my own bot patterns? =

Yes, you can add custom user agent patterns in the plugin settings page.

== Changelog ==

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.0.0 =
Initial release 
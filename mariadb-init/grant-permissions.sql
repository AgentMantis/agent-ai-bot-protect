-- Grant all privileges to bn_wordpress user from any host
CREATE USER IF NOT EXISTS 'bn_wordpress'@'%' IDENTIFIED BY 'bitnami_wordpress';
GRANT ALL PRIVILEGES ON bitnami_wordpress.* TO 'bn_wordpress'@'%';

-- Grant privileges to bn_wordpress user from localhost
CREATE USER IF NOT EXISTS 'bn_wordpress'@'localhost' IDENTIFIED BY 'bitnami_wordpress';
GRANT ALL PRIVILEGES ON bitnami_wordpress.* TO 'bn_wordpress'@'localhost';

-- Grant privileges to bn_wordpress user from the WordPress container
CREATE USER IF NOT EXISTS 'bn_wordpress'@'%' IDENTIFIED BY 'bitnami_wordpress';
GRANT ALL PRIVILEGES ON bitnami_wordpress.* TO 'bn_wordpress'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES; 
# Bot Shield

Bot Shield is a plugin for Wordpress that allows you to protect your website from AI Bots.

It is built on an Angular Custom Element that is inserted into the Wordpress admin dashboard.

## Start Docker
```
docker-compose -f docker-compose.yaml up -d
```

* IMPORTANT info for mounting the bot-shield plugin within the `docker-compose.yaml` file.
* Ensure this line is commented out on the initial execution of the docker compose, otherwise the wordpress container will not start.
* To mount the bot-shield plugin, uncomment the line below and restart the docker compose.
```
# - './plugins/bot-shield:/bitnami/wordpress/wp-content/plugins/bot-shield'
```



## Wordpress admin
http://localhost/wp-admin/

* username: admin
* password: adminpassword


# Build the BotShield plugin

```
cd bot-shield-app
npm install
npm run build:element
```

Refresh the wordpress page and the BotShield plugin should be available.

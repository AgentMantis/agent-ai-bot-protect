# Agent AI Bot Protect

Agent AI Bot Protect is a plugin for Wordpress that allows you to protect your website from AI Bots.

It is built on an Angular Custom Element that is inserted into the Wordpress admin dashboard.

## Start Docker
Ensure the Docker desktop app is running.

Start the docker container:
```
docker-compose -f docker-compose.yaml up -d
```

* IMPORTANT info for mounting the agent-ai-bot-protect plugin within the `docker-compose.yaml` file.
* Ensure this line is commented out on the initial execution of the docker compose, otherwise the wordpress container will not start.
* To mount the agent-ai-bot-protect plugin, uncomment the line below and restart the docker compose.
```
# - './plugins/agent-ai-bot-protect:/bitnami/wordpress/wp-content/plugins/agent-ai-bot-protect'
```

## Access DB

To access DB via workbench or DBeaver, use user `root` with no password.


## Wordpress admin
http://localhost/wp-admin/

* username: admin
* password: adminpassword


# Build the plugin

```
cd app
npm install
npm run build:element
```

Refresh the wordpress page and the AgentAIBotProtect plugin should be available.

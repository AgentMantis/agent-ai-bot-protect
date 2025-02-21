



## Start Docker
```
docker-compose -f docker-compose.yaml up -d
```

FIXME: , if the wordpress fails to start, comment out the line in docker-compose.yaml that mounts the plugins folder.

e.g 
```
- './plugins:/bitnami/wordpress/wp-content/plugins/'
```

becomes
```
# - './plugins:/bitnami/wordpress/wp-content/plugins/'
```

Then start the docker compose again.  

Then re-enable the line in docker-compose.yaml that mounts the plugins folder.

```
- './plugins:/bitnami/wordpress/wp-content/plugins/'
```

and restart the docker compose again.

This is a bug that will be fixed in a future release.




## Wordpress admin
http://localhost/wp-admin/

* username: admin
* password: adminpassword


# Build the Bot Shield plugin

```
cd bot-shield-app
npm install
npm run build:element
```

Refresh the wordpress page and the Bot Shield plugin should be available.

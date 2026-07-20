# Trichy Insight deployment

This repository contains prebuilt API and web artifacts. The container starts the
API server, serves the web application, and listens on the port supplied by the
hosting platform.

## Publish from GitHub (Render or Railway)

1. Create an empty GitHub repository and add it as this repository's remote:

   ```sh
   git remote add origin https://github.com/OWNER/REPOSITORY.git
   git push -u origin work
   ```

2. In Render choose **New > Web Service**, or in Railway choose **New Project >
   Deploy from GitHub repo**, then select the repository.
3. Select **Dockerfile** as the build/deploy method. No build or start command is
   needed because both are defined in the image.
4. Add the application secrets listed below in the host's environment-variable
   settings. Do not commit secret values to Git.
5. Deploy and confirm that `https://YOUR_HOST/api/healthz` returns a successful
   response, then open `https://YOUR_HOST/`.

Render and Railway provide `PORT` automatically. On another host, set `PORT` to a
positive integer (for example `3000`). Also set `NODE_ENV=production` when the
host does not use the Dockerfile.

## Required application secrets

Configure the services used by your installation:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL
```

Features such as email, AI generation, object storage, social publishing, push
notifications, and Google indexing require their corresponding provider secrets.
The server references these optional variables: `RESEND_API_KEY`,
`GEMINI_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`,
`R2_BUCKET_NAME`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`GOOGLE_SERVICE_ACCOUNT_JSON`.

## Publish with Docker directly

Build and test the same image locally:

```sh
docker build -t trichy-insight .
docker run --rm -p 3000:3000 --env-file .env -e PORT=3000 trichy-insight
curl --fail http://localhost:3000/api/healthz
```

To publish the image to a registry:

```sh
docker tag trichy-insight REGISTRY/OWNER/trichy-insight:latest
docker login REGISTRY
docker push REGISTRY/OWNER/trichy-insight:latest
```

Deploy that image on any container host, pass the environment variables through
the host's secret manager, and route public traffic to the configured `PORT`.

## Custom domain

After the generated host URL works, add `trichyinsight.online` in the hosting
provider's custom-domain settings and create the DNS records it supplies. Add
`www.trichyinsight.online` as well; the server redirects `www` traffic to the
apex domain. Wait for TLS provisioning before changing production traffic.

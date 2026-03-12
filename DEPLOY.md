# Deploy: GitHub + Vercel

## 1. GitHub (one-time)

You need a repo on GitHub and to push `main`.

**Option A – GitHub website**

1. Create a new repo: https://github.com/new  
   - Name: `mnq-pulse` (or any name)  
   - Do **not** add a README or .gitignore.
2. From the project root run (replace `YOUR_USERNAME` with your GitHub username):

```bash
git remote add origin https://github.com/YOUR_USERNAME/mnq-pulse.git 
git push -u origin main
```

**Option B – GitHub CLI**

```bash
# Install if needed: sudo apt install gh  OR  use ~/.local/bin/gh (already in repo)
gh auth login
cd /home/jdavis/mnq-pulse
gh repo create mnq-pulse --public --source=. --remote=origin --push
```

## 2. Vercel (one-time login, then deploy)

From the project root:

```bash
# Log in (opens browser or prints URL)
npx vercel login

# Preview deploy
npx vercel

# Production deploy (after you’re happy with preview)
npx vercel --prod
```

If the project isn’t linked yet, the CLI will ask to link or create a Vercel project. Connect it to your GitHub account when prompted.

## 3. Environment variables on Vercel

The app uses **in-memory storage** by default (news, settings, calendar). No database is required to run it.

- **`FINNHUB_API_KEY`** – Recommended for production. Without a database, in-memory settings do not persist across serverless invocations. Set your Finnhub API key here so the app can fetch news reliably. Get a free key at https://finnhub.io/register.
- **`DATABASE_URL`** – Optional. Only set this if you add Postgres and run `npm run db:push` (Drizzle migrations). Not required for the app to run on Vercel.

Add any variables in the Vercel project: **Settings → Environment Variables**, then redeploy.

## 4. After first push

Once GitHub is connected in Vercel, future pushes to `main` will trigger production deployments; other branches get preview URLs.

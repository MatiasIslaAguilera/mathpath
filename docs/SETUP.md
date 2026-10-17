# Setup: phone + database (about 15 minutes, once)

You end up with:
- the app at `https://<your-github-username>.github.io/mathpath/`
- installed on your phone
- progress synced through your own free Supabase database

Only your account can read your data.

## 1. Supabase (the database)

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign in (GitHub sign-in works).
2. **New project**:
   - Name: `mathpath`
   - Database password: anything strong (you won't need it day to day)
   - Region: the one closest to you
   - Wait about 2 minutes while it starts.
3. Create the tables:
   1. Left sidebar → **SQL Editor** → **New query**.
   2. Paste the whole contents of [`supabase/migrations/0001_learning_log.sql`](../supabase/migrations/0001_learning_log.sql).
   3. Click **Run**. You should see "Success. No rows returned".
4. Copy two values from **Project Settings → API** (or **Connect**):
   - **Project URL**, like `https://abcdefgh.supabase.co`
   - **anon public** key, a long string starting with `eyJ`

   The anon key is meant to be public. Row-level security in the SQL above is what keeps your data private.
5. **Authentication → URL Configuration → Site URL**: set it to `https://<your-github-username>.github.io/mathpath/`. Confirmation emails then link back to the app.
6. Optional: by default Supabase emails you a confirmation link when you create your account. To skip that step, go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. It's your personal app, so either way is fine.

## 2. GitHub (the hosting)

1. Create a new repository on [github.com/new](https://github.com/new):
   - Name: `mathpath`
   - Visibility: **Public** (free GitHub Pages needs a public repo; only the app's code goes there, never your progress)
   - Don't add a README, .gitignore or license: it must be **empty**.
2. In the new repo, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**, twice:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
4. Send Claude the repository URL. Claude pushes the code.
   - The first push may open a browser window asking you to sign in to GitHub. That's Git Credential Manager; approve it.
   - Each push runs the tests and deploys automatically (Actions tab, about 3 minutes).

## 3. Your phone

1. Open `https://<your-github-username>.github.io/mathpath/` in **Safari** (iPhone) or **Chrome** (Android).
2. Install it:
   - **iPhone:** Share button → **Add to Home Screen**.
   - **Android:** ⋮ menu → **Install app** (or **Add to Home screen**).
3. Open it from the home-screen icon.
4. Go to **Settings → Account & sync → Create account** with your email and a password.
5. On your computer, open the same URL and **Sign in** with the same account. Your current progress on this PC uploads automatically the first time.

From then on, every answer syncs within a couple of seconds when you're online. Offline answers wait on the device and upload later. Nothing is lost if you use both devices offline on the same day.

## 4. Daily reminder

On your phone, go to **Settings → Daily reminder**, pick a time, and tap **Add to my calendar**. Your phone's calendar reminds you every day, even when the app is closed.

## For the weak-spot analysis

Two ways to give Claude your full answer history:
- **Settings → Backup → Export progress.json**, then put the file in the project folder.
- In Supabase **SQL Editor**, run `select * from attempt_log order by ts;` and export the result as CSV.

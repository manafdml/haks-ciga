# Hak's Ciga Co ltd — Sales & Inventory App

A phone-style web app to track **boxes purchased**, **pieces sold**, and **profit/loss per day** for **Gold Seal**, **Rothman**, and **Oris**.

Auth + storage are handled by **Supabase** (free tier). Data is shared across all logged-in users, so the shop owner and his friend always see the same numbers.

---

## How to run

1. Open a terminal in this folder:
   ```
   cd "Haq's Cigarettes"
   ```
2. Start a tiny local server:
   ```
   python3 -m http.server 8765
   ```
3. Open the browser at **http://localhost:8765**

> No build step, no install. Pure HTML / CSS / JavaScript + the Supabase SDK via CDN.

---

## One-time Supabase setup

You only do this **once**. It takes about 5 minutes.

### Step 1 — Create a Supabase account & project (free)

1. Go to **https://supabase.com** → click **Start your project** → sign in with GitHub or email.
2. Click **New project**.
   - **Name**: `haks-ciga` (anything is fine).
   - **Database password**: pick a strong one and save it somewhere safe (you won't need it day-to-day, but you can't recover it).
   - **Region**: pick the one closest to where you live.
   - **Pricing plan**: Free.
3. Click **Create new project** and wait ~2 minutes while it provisions.

### Step 2 — Create the database tables

1. In the left sidebar click **SQL Editor** → **New query**.
2. Open the file [supabase/schema.sql](supabase/schema.sql) from this project.
3. Copy its entire contents, paste into the SQL editor, click **Run**.
4. You should see "Success. No rows returned." — that means the 3 tables and the security policies are created.

### Step 3 — Create the users (you + your friend)

1. In the left sidebar click **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter an email and a password for yourself. Tick **Auto Confirm User** so you don't need to verify the email.
3. Click **Create user**. Repeat for your friend.
4. *(Optional but recommended)* In the left sidebar → **Authentication** → **Sign In / Up** → turn **OFF** "Allow new users to sign up". This way only people you create can log in.

### Step 4 — Copy the API keys

1. In the left sidebar click the gear icon (**Project Settings**) → **API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Project API keys → `anon` `public`** (a long string starting with `eyJ...`)

> The `anon` key is **safe to put in client-side JavaScript**. Row-Level Security (already set up in step 2) is what actually protects your data — only logged-in users can read or write.

### Step 5 — Paste the keys into the app

1. Open the file [js/config.js](js/config.js).
2. Replace the two `PASTE_...HERE` strings with the Project URL and anon key from step 4.
3. Save the file.
4. Refresh the browser. You're done.

---

## Login

Use the email + password you created in Supabase (step 3). Sessions persist — you stay logged in across refreshes until you tap **Logout**.

The old mock `haq / 1234` is gone. There are no hardcoded users any more.

---

## First-time setup for a product (after login)

1. Tap a product tile (Gold Seal / Rothman / Oris).
2. **Add Purchase (Boxes)**: enter boxes, cost per box, pieces per box → **Add Purchase**.
   - The app computes total pieces added and the running **weighted average cost per piece**.
3. **Selling Price (per piece)**: enter the price you charge per piece → **Save**.

You're ready to record sales.

> Buying more boxes later at a different cost? Just add another purchase — the average cost is recomputed for you.

---

## Recording a day's sales (under 10 seconds)

1. Open a product.
2. Under **Record Day's Sales**: date defaults to today; enter total pieces sold; tap **Record Sales**.

What happens:
- The row goes straight into the Supabase `sales` table.
- Stock is reduced.
- Today's revenue and P/L update immediately on the dashboard.

---

## Daily totals & combined report

Dashboard shows today's revenue, P/L, pieces sold, stock remaining, and per-product summary.
Tap **📊 Combined Report** for an all-time + today comparison across all three products.

---

## Resetting a product

Product page → **Reset Product Data**. Deletes the product's purchases and sales **from the database** (irreversible). Confirms with a popup.

---

## Folder structure

```
Haq's Cigarettes/
├── index.html              ← entry point
├── css/
│   └── styles.css
├── js/
│   ├── config.js           ← PASTE YOUR SUPABASE KEYS HERE
│   └── app.js              ← auth + data layer + UI logic
├── supabase/
│   └── schema.sql          ← run once in Supabase SQL editor
├── assets/                 ← (room for logos)
├── CLAUD.md
└── README.md
```

---

## How profit/loss is calculated

- Each purchase is stored as a row in `purchases`. On login, the app replays all purchases + sales **in chronological order** to compute a weighted average cost per piece:
  `new_avg = (old_stock × old_avg + boxes × cost_per_box) / new_stock`
- Each sale snapshots the avg cost **at the time of sale** into the `sales.cost` column, so historical P/L is locked in even if you buy more stock later at a different price.
- Today's P/L = `sum((sales.price - sales.cost) * sales.qty)` for rows where `sale_date = today`.

---

## Troubleshooting

| Message / symptom | Fix |
|---|---|
| "Setup needed — open js/config.js…" | You haven't pasted the Supabase URL + anon key yet. Follow setup step 5. |
| "Invalid login credentials" | The email/password is wrong. Go to Supabase → Authentication → Users to verify or re-create. |
| "Email not confirmed" | When you created the user in Supabase, you didn't tick **Auto Confirm User**. Either tick it now, or send a confirmation email. |
| Login works but no data loads | The SQL in step 2 wasn't run, or it ran in the wrong project. Re-run [supabase/schema.sql](supabase/schema.sql) in the right project's SQL Editor. |
| "permission denied for table …" | RLS policies missing. Re-run [supabase/schema.sql](supabase/schema.sql) — it's idempotent. |
| Buttons do nothing / `supabase is not defined` | Make sure you opened the app via `http://localhost:…`, not by double-clicking `index.html`. The CDN script needs HTTP. |

---

## Security notes

- The `anon` key in `js/config.js` is **meant to be public**. Don't paste the `service_role` key into client code — that one bypasses RLS.
- RLS is configured so **only authenticated users** can read or write. Anonymous visitors get nothing.
- All three users (you, your friend, future ones) share the same data set — that's the shop's books.
- If you ever want per-user isolation, message me to tighten the RLS policies (add `user_id uuid references auth.users` and filter by `auth.uid()`).

---

Chief Engineer · **Mahamood Manaf**

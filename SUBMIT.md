Written for: Priyanshi, finishing the submission alone.

# START HERE — everything left to do

This file is self-contained. You do not need to ask anyone anything to finish.
Work top to bottom. Total time: about 50 minutes, most of it the video.

---

## 0. See the app right now (10 seconds)

Open File Explorer → `C:\Users\user\Desktop\aura` → **double-click `index.html`**.

That's it. No server, no install, no internet. If it opens and you see a dark map with
route cards, everything works.

> The black phone frame on the left is the app. The panel on the right labelled
> **Demo rig** is the simulated battery/GPS/clock — it is meant to be visible, it shows
> judges you didn't fake the data silently.

---

## 1. GitHub repository (5 min)

Git is **not** installed and you **do not need it**. This is all browser.

1. Go to **https://github.com/new**
2. Repository name: `aura`
3. Set **Public**
4. Leave every checkbox **unticked** (do not add a README — ours would conflict)
5. Click **Create repository**
6. On the next page, click the link **"uploading an existing file"** (in the grey box)
7. Open `C:\Users\user\Desktop\aura` in File Explorer
8. Press **Ctrl+A** to select all 14 files, and drag them into the browser window
9. Commit message: `Aura — Round 1 and Round 2`
10. Click **Commit changes**

**Your repo link:** `https://github.com/priyanshicodes01/aura`

---

## 2. Vercel deployed link (5 min)

1. Go to **https://vercel.com/signup**
2. Click **Continue with GitHub** ← important, this links both accounts in one step
3. Authorise Vercel when GitHub asks
4. Dashboard → **Add New… → Project**
5. Find `aura` in the list → **Import**
   - Not there? Click **Adjust GitHub App Permissions** and grant access to `aura`
6. On the config screen **change nothing**. Framework Preset should say `Other`.
   Build Command, Output Directory: leave empty.
7. Click **Deploy**, wait ~30 seconds
8. Copy the URL from the **Visit** button

**Your deployed link:** `https://aura-something.vercel.app`

### If Vercel misbehaves, use the terminal instead
Node is already installed, so this works without GitHub at all:

```powershell
cd C:\Users\user\Desktop\aura
npx vercel login
npx vercel --prod
```
Press Enter to accept every default. It prints your URL at the end.

---

## 3. PPT (10 min)

Open **`Aura-deck.md`**. It is 15 slides, already written, in order.

- Each `## Slide N — Title` block is **one slide**
- The bold/plain text under it is the **slide content** — paste it as-is
- The indented `>` lines are **speaker notes** — do NOT put these on the slide, they are
  what you say out loud
- Tables paste straight into PowerPoint as tables

**Short on time?** Use only slides **1, 2, 3, 4, 6, 8, 12, 13, 14**. That is nine slides
and still covers both rounds and every constraint in the problem statement.
Never cut 3, 6, 8 or 12 — those are the ones that win points.

---

## 4. Demo video (20 min, including retakes)

Open **`DEMO-SCRIPT.md`** and follow it. It has the exact clicks and the exact words.

**To record on Windows:** press `Win + Alt + R` to start recording, and again to stop.
Videos save to `Videos\Captures`.

**Before you record**, set the demo rig to: Time `23:00`, Battery `34%`,
Progress `0%`, Drain `Steady`, Connectivity `Offline`. Then reload the page.

**If you only have time for one take, do these five beats:**
1. Point at the two walking routes — 17 min vs 23 min
2. Click the chip *"I'm walking home alone, it's late and my phone is dying"*
   → it recommends the 23-minute lit road, and the Why panel explains the six minutes
3. Set **Battery drain → Heavy**, wait for the amber banner, read the arithmetic aloud
4. Click **Switch to Shadow Mode**, then drag the **Ghost Ping** slider
5. Point at the request counter showing `0` — "zero network requests the whole way"

That is 60 seconds and it covers both rounds.

---

## 5. Submit

| Field | What to paste |
|---|---|
| GitHub repository | `https://github.com/priyanshicodes01/aura` |
| Deployed website | your `…vercel.app` URL |
| PPT | the file you made in step 3 |
| Demo video | the file from step 4 |

**Last thing before you submit:** open `README.md` on GitHub, click the pencil icon,
and replace the line `Live: _add your Vercel URL here_` with your actual Vercel URL.
Judges open the README first.

---

## If something looks broken

| Problem | Fix |
|---|---|
| Blank white page | You opened a `.md` file by mistake. Open **`index.html`**. |
| Map missing, cards showing | Hard-refresh with **Ctrl+Shift+R**. |
| Nothing happens clicking chips | Hard-refresh with **Ctrl+Shift+R**. |
| Ghost Ping slider won't drag | Click and *hold* the white circle, then drag right. It needs to pass 80%. |
| Shadow Mode won't close | Click the top row (where it says `6%` / `OFFLINE`). |
| Vercel shows a build error | Project Settings → General → Framework Preset → set to **Other** → Redeploy. |
| Phone layout looks cramped | Expected on very small screens; the demo rig moves below the phone. |

---

## The one-sentence answer, if a judge only asks you one question

> "Aura compares journeys by what is physically on the street — lamps, open shops,
> verified municipal buses — never by an area's reputation, so it can help her choose
> without ever labelling a neighbourhood or tracking her. And when her battery is dying
> and the signal is gone, it drops to a black screen with one arrow and one SMS
> check-in that needs no internet at all."

# The Ananya Subramanian Show — website

Single-page site for **The Ananya Subramanian Show** (*Conversations across world sports*), hosted on Cloudflare Pages at **theananyasubramanianshow.com**.

Plain HTML, CSS and JavaScript. There is no framework and no build step.

```
index.html            the page
assets/app.js         all settings and site logic (settings are at the very top)
assets/styles.css     all styling (colours and fonts are CSS variables at the top)
assets/               logo, logo mark, host photo, favicons, social share image
functions/feed.js     Cloudflare Pages Function that serves your RSS feed at /feed
```

---

## 1. Your RSS feed URL

Your feed is already set: `https://anchor.fm/s/1060d0c44/podcast/rss`

If it ever changes, you can find it here:

- **Spotify for Creators (Anchor):** creators.spotify.com → your show → **Settings** → **Availability** → **RSS feed** → copy.
- **Other hosts** (Buzzsprout, Libsyn, etc.): look for "RSS feed" under your show's settings or distribution page.

### Where to paste it

1. **`assets/app.js`**, line ~9: `const FEED_URL = '…';`
2. **Cloudflare Pages:** set the `FEED_URL` environment variable (see below). This is what `/feed` uses.
3. Optional: `DEFAULT_FEED_URL` in `functions/feed.js`, used only if the environment variable is missing.

### How episodes load

The page tries three sources, in order:

1. **`/feed`**: the Cloudflare Pages Function. It fetches your feed server-side (so there are no CORS problems) and caches it for 15 minutes.
2. **`FEED_URL`** directly from the browser.
3. **Built-in sample episodes**, so the layout still previews offline. These are labelled "Sample:" and a note under "Stories you'll love" says the live feed couldn't be reached.

New episodes appear automatically, within about 15 minutes of publishing.

---

## 2. Deploying on Cloudflare Pages

1. Push this folder to a GitHub repo.
2. In Cloudflare, go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and pick the repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`/`**
4. **Settings → Environment variables** → add, for **Production** (and **Preview** if you like):
   - `FEED_URL` = `https://anchor.fm/s/1060d0c44/podcast/rss`
5. Deploy. The `functions/` folder is picked up automatically, so `/feed` just works.
6. **Custom domains** → add `theananyasubramanianshow.com` (and `www.` if you want it).

To check it: open `https://theananyasubramanianshow.com/feed`. You should see your RSS XML.

**Local preview:** run `python3 -m http.server` in this folder and open http://localhost:8000. There is no `/feed` locally, so the page falls back to loading `FEED_URL` directly, which works because Anchor allows it. For a full local test including the Function, run `npx wrangler pages dev .`.

---

## 3. How the interviews-only filter works

Your feed also contains the older analysis episodes. They are removed **before anything is rendered**, so they never appear in the filmstrip, the featured card, the grid, search, or the "Watch the latest" button.

All of the rules live at the top of `assets/app.js`:

| Setting | What it does |
|---|---|
| `EXCLUDE_WORDS = ['analy']` | Hides any episode whose **title** has a word *starting* with one of these, case-insensitive (analysis, analyst, analytics…). Add more words to the list if you need to. |
| `MIN_MINUTES = 10` | Hides episodes shorter than 10 minutes. Most of the old analysis episodes are 2–7-minute recaps whose titles don't contain "analysis", so this is the rule that removes them. Every interview runs 11 minutes or more. Set it to `0` to turn it off. |
| `HIDE_EPISODES = [...]` | Hides exact titles (curly vs straight quotes and capitals don't matter) or episode numbers. It starts with the two Bay Area Women's Open results episodes and the two previews (MLC, Women's T20 World Cup). Numbers refer to the feed's own `itunes:episode` value. Your feed doesn't set one at the moment, so use titles. |
| `SHOW_EPISODES = [...]` | Always shows these exact titles, even if a rule above would hide them. |
| `RENUMBER = true` | Numbers the remaining interviews 1, 2, 3… (oldest = 1, newest = highest) with no gaps. Set it to `false` to use the feed's own episode numbers. |

**Heads-up:** *"From IPL Analytics to Building American Cricket | Unni Krishnan"* is an interview, but its title contains "Analytics", so the `analy` rule hides it. To show it, uncomment that line in `SHOW_EPISODES`.

To hide another episode, copy its title into `HIDE_EPISODES`. A new interview shorter than 10 minutes would be hidden too: lower `MIN_MINUTES` or add its title to `SHOW_EPISODES`.

### Other things taken from the feed

- **Sport tag:** matched on keywords in the title, then the show notes:
  - Cricket: cricket, IPL, BBL, The Hundred, MLC, WPL, T20
  - Football: football, soccer, Premier League, NWSL, MLS
  - Basketball: NBA, WNBA
  - Tennis
  - Baseball: MLB
  - Athletics: track, marathon, Olympic

  Episodes with no match show "Interview" and sit under the "Other" filter. Keywords are in `SPORTS` in `app.js`.
- **Guest name** ("with …"): worked out from the title, e.g. "| Lloyd Jodah", "with Bipul Sharma", "Sindhu Sriharsha on …", "Kevin Christian's Journey". If a title doesn't contain a name, the line is left off.
- **YouTube:** if an episode's show notes include a YouTube link, the card shows "Watch on YouTube ↗".

---

## 4. Your remaining links

In `assets/app.js`, `LINKS` (near the top):

```js
const LINKS = {
  linkedin: 'https://www.linkedin.com/in/ananya-subramanian-3b38621aa/',
  youtube: '',   // TODO
  instagram: '', // TODO
  spotify: '',   // TODO
  apple: '',     // TODO
};
```

Until they're filled in:

- **Spotify, Apple Podcasts and YouTube** buttons open a search for "The Ananya Subramanian Show" on that platform, so they still work.
- **Instagram** is hidden.
- **RSS** always points to `FEED_URL`.

These links appear in the host section, the Subscribe section and the footer, and all of them update from this one list.

Your guest-pitch email is in `index.html` (the "Drop us a line" button, a `mailto:` link with the subject line already filled in).

---

## 5. Other notes

- **Colours and fonts:** CSS variables at the top of `assets/styles.css`. The accent colour is `--accent: #ff6a1a`.
- **Host photo:** `assets/ananya.jpg`, used only in the "Your host" section.
- **Social share image:** `assets/og-image.png` (1200×630).
- **Favicons:** `assets/favicon.svg`, `favicon-32.png` and `apple-touch-icon.png`, all made from the logo mark.
- **Reduced motion:** visitors with "reduce motion" turned on get a still page: no letter animations, marquees, filmstrip scrolling, scrambling or blur-ins.

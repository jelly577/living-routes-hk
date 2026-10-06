# Shared Community setup

The GitHub Pages frontend can remain at its existing address. Supabase stores
public Community posts and public JPEG photos. Private Journal posts remain in
the browser's IndexedDB; they are never automatically migrated.

## Connect a project

1. Create or select a Supabase project. Project creation, plan selection and
   billing must be approved by the project owner.
2. In the SQL editor, run `community.sql` once. It creates the table, storage
   bucket and row-level security policies. Do not disable RLS.
3. Enable anonymous sign-ins under Authentication settings. These are temporary
   browser-bound publisher identities, **not** permanent username accounts.
4. Find the project's URL and frontend **publishable** key. Never use a
   `service_role`, secret key or database password in the frontend.
5. For local testing, copy `.env.example` to `.env.local`, set
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and restart Vite.
6. For GitHub Pages, add repository Actions secrets with those same names,
   then run the deployment workflow after merging the code. Vite embeds these
   public values during the build; changing secrets requires a new deployment.

## Existing posts

On the **same browser and origin** where old posts were saved, open Community.
Once connected, each old local Community post has a manual publish button.
Choosing it uploads that post and its processed image. Private posts have no
automatic upload path. Posts stored on localhost and GitHub Pages are separate.
The bulk publish button uploads all old Community-marked posts from this browser,
including posts hidden by the current feed filter. It excludes private entries,
reports failures, and allows retrying. Default demo posts are not in the feed.

## Acceptance checks before declaring it live

Use two independent browsers/devices, not two tabs sharing browser storage:

- Browser A posts text and a photo with Community visibility.
- Browser B visits the production URL without signing in, refreshes Community,
  and sees A's text and image. B must not have a delete button for A's post.
- A can delete its own post; B refreshes and the post is gone.
- A saves a private Journal entry; B cannot see it, and no row or storage object
  is created for it in Supabase.
- Repeat with an old local Community post using its manual publish button.
- Test actual database RLS using different user sessions: B's delete of A's ID
  must affect zero rows; B's insert using A's owner_id must be rejected.

`npm run test:community` tests client contracts with a mock database. It does
not validate the deployed SQL policies or replace these real two-browser tests.

## MVP limitations

- Anonymous publisher ownership survives reloads, but not clearing browser
  storage, switching browsers or changing website origin. Add permanent Auth
  accounts before promising cross-device author management.
- Community shows the latest 200 shared posts; refresh loads current data.
- New posts support a contributor-chosen district, a named place (optionally
  tagged with a district), or no location. The public map uses one approximate
  display anchor per district with a public-story count. Private posts are
  excluded; exact legacy pins no longer produce per-post public markers.
  Existing unclassified posts keep their data; no district is guessed for them.
- District names follow https://www.had.gov.hk/en/18_districts/my_map.htm.
  Display anchors are illustrative, not official district centroids/boundaries.
- Public posts/photos are genuinely public, including the supplied author name.
  There is an unverified label, not an implemented moderator approval queue.
- Add moderation, reporting, abuse controls, deletion/account recovery and
  backups before opening a production public community at scale.
- Existing content gaps remain reported by the upstream report-only audit;
  service/community/district tests remain blocking deployment checks.

Official references:
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control

## Memoir video AI captions (optional)

The Journal's travel-memoir video works without this: captions then come from
the user's own words. To let AI write captions from the photos:

1. Install the Supabase CLI and link the project (`supabase link`).
2. Store the model key as a function secret — never in `VITE_*` variables,
   which are public in the GitHub Pages build:
   `supabase secrets set ANTHROPIC_API_KEY=...`
   Optional: `supabase secrets set MEMOIR_MODEL=<model id>` (default `claude-sonnet-5-5`).
3. Deploy: `supabase functions deploy memoir` (source: `functions/memoir/index.ts`).
   Keep JWT verification on; the app signs in anonymously before calling it.

What is sent, only after the user ticks the AI consent box in the memoir
panel: the selected memories' notes, their dates, place *names*, and photos
downscaled to 768 px. Exact photo GPS never leaves the device (it is also
stripped from every public Community post). If the function is missing or
fails, the app falls back to the user's own words and says so.

# JB Automate

A static-first business website for JB Automate: tailored AI apps, business workflows, websites, and ongoing support. Built with Astro, TypeScript, and plain CSS.

The default build is an honest **design preview**. It is not indexed by search engines and does not pretend to send enquiries when email delivery is unconfigured.

## Local development

Use Node.js 24 or newer.

```powershell
npm ci
npm run dev
```

Open the local URL printed by Astro. No environment file is needed to explore the design.

Run `npm ci` for initial setup or when dependencies change. If dependencies are already installed, start with `npm run dev` directly.

**Windows:** Stop this project's dev/preview processes before reinstalling dependencies (`Ctrl+C` in their terminals, or ask the agent to stop a preview it started). Astro loads a native `.node` compiler file that Windows locks while the process is running. If `npm ci` fails with `EPERM ... unlink` for that file, stop those processes and rerun `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run check` | Check Astro and TypeScript files. |
| `npm test` | Run focused content, publishing, and contact tests using Node's test runner. |
| `npm run enquiries` | Print the most recently stored enquiry copies, when a database is configured. |
| `npm run build` | Check publishing prerequisites and create the Vercel deployment output. |
| `npm run preview` | Serve the built marketing pages locally; this static preview does not run the enquiry endpoint. |

The Vercel adapter does not support `astro preview`, so the preview command uses Vite to serve the generated static output. Use `npm run dev` for local endpoint behavior, or an authorized Vercel environment for the deployed serverless function. Do not use the static preview as a live enquiry service.

## Editing the site

Most business copy lives in `src\content\site.ts`: the hero, services, proof statement, example scenes, comparison rows, support wording, FAQs, and privacy retention text.

- `src\styles\global.css`: shared colors, typography, navigation, footer, and privacy-page styling.
- `src\styles\home.css`: homepage composition, illustration styling, and responsive layouts.
- `src\components\`: individual page sections. The comparison is `DeliveryComparison.astro`.
- `src\pages\index.astro`: landing-page composition.
- `src\pages\privacy.astro`: privacy notice.
- `public\images\`: original social-preview artwork.
- `public\favicon.svg`: original brand icon.

The production domain and delivery credentials are environment configuration. The published contact address defaults to `admin@jbautomate.ca` in `src\lib\site-config.ts`; `PUBLIC_CONTACT_EMAIL` overrides it for another deployment.

### Visuals and interaction

The page uses an original paper-and-workbench illustration system, not stock AI icons or miniature dashboard screenshots. Illustration text is ordinary HTML so it remains readable instead of shrinking with an SVG. Body copy is generally 18px, interface text is at least 16px, and supporting notices never fall below 14px.

| File | Responsibility |
| --- | --- |
| `src\components\Hero.astro`, `WorkBench.astro` | Centered opening with a scroll-driven paper-to-brief scene. |
| `src\components\WorkExamples.astro` | Three always-visible service chapters: a prepared follow-up, connected handoffs, and a composed website. |
| `src\components\WorkshopArt.astro` | Original SVG geometry shared by the visual scenes. |
| `src\components\StoryMotion.astro` | Shared native-scroll scene controller, SVG drawing, responsive sticky eligibility, and motion lifecycle. |
| `src\lib\interaction.ts` | Validated scene/stage progress and available-space calculations. |

Scrolling assembles the opening and reveals each service outcome; no replay, run, connection, or palette buttons are needed. The hero briefly sticks only on sufficiently wide and tall screens when its entire composition fits below the header. Scrolling stays native, reverses the sequence predictably, and never blocks contact links. Optional fine-pointer hover responses add detail without hiding information or creating extra keyboard stops.

Service animations wait until the artwork is substantially in view, then progress evenly as its center moves through the viewport. Their timing is separate from the hero and the background line drawings.

The examples use fixed sample content: no AI request is made and no business data is sent. Reduced-motion preferences show the finished artwork in normal page flow, including when the preference changes during a visit. Without JavaScript or the required animation APIs, every service and outcome remains visible as static content. Keep these fallbacks when editing the presentation.

The controller batches active-scene updates into animation frames, stops observing on page exit, and restores on back/forward navigation. Scroll and hover use separate artwork layers. Avoid adding independent timers or competing transform animations to the scene components.

### Content boundaries

The Government of Alberta reference is the authorized **text-only relationship statement**. Do not add its logo, imply endorsement, or expose confidential details. `proof.verifiedOutcome` is empty until a verified, approved result and its context are supplied.

Product illustrations are original concept artwork, not real client screenshots. Do not replace them with real client work without approval.

The Claude comparison describes a one-off generated starting point versus a delivered service. It does not claim that Claude's enterprise offerings lack security or privacy.

Describe support according to the actual engagement. This site does not promise blanket round-the-clock availability, a fixed response time, compliance certification, flawless AI output, or suitability for every category of protected data.

## Enquiry configuration

Copy `.env.example` to `.env` for local configuration. Never commit `.env` or credentials. For a deployment, set values in the hosting project's environment settings.

| Variable | Purpose |
| --- | --- |
| `SITE_MODE` | `preview` by default; `production` enables production-readiness requirements. |
| `PUBLIC_SITE_URL` | Real HTTPS site origin, without a path or credentials. |
| `PUBLIC_CONTACT_EMAIL` | The public, visible contact address. |
| `PUBLIC_GOOGLE_ADS_ID` | Optional Google Ads tag ID in the form `AW-...`. |
| `PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` | Optional lead-conversion label paired with the Ads tag ID. |
| `PUBLIC_SUPABASE_URL` | Public Supabase project origin used by static builds for best-effort enquiry capture. |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe `sb_publishable_...` key. Security comes from database grants and RLS, not secrecy. |
| `RESEND_API_KEY` | Server-only Resend key. |
| `CONTACT_FROM_EMAIL` | Plain sender email on the authenticated sending domain. |
| `CONTACT_TO_EMAIL` | Fixed, server-only recipient. A visitor cannot choose it. |
| `CONTACT_RATE_LIMIT_CONFIGURED` | Set to `true` only after configuring a real hosting-level rule for the form. This flag does not create a rate limiter. |
| `PRIVACY_NOTICE_APPROVED` | Set to `true` after supplying and approving the actual privacy practices. |
| `ENQUIRY_DELIVERY` | `server` (default) expects the endpoint and Resend. `email_app` is a static deployment with no endpoint, where the form hands the enquiry to the visitor's own email application. |
| `DATABASE_URL` | Optional PostgreSQL connection string. When set, a copy of each valid enquiry is stored so it can be followed up. When empty, nothing is stored. |
| `ENQUIRY_HASH_SALT` | Optional salt for the stored hashes. Use a long random value; changing it resets duplicate and throttle matching. |

The form collects name, email, optional business name, and a short description. It does not accept attachments, protected business datasets, or account credentials.

### How an enquiry reaches us

The form adapts to the deployment, and the privacy notice changes with it:

- **With the endpoint** (`RESEND_API_KEY` and the rest configured): the browser posts to `src\pages\api\contact.ts`, which validates the request, emails it through Resend, and stores a copy when `DATABASE_URL` is set. The button confirms the enquiry was sent.
- **Without the endpoint** (any static build, including GitHub Pages): after validation, the browser makes a best-effort insert into the Supabase enquiry table and immediately continues the existing email-app handoff. Capture success or failure never changes the visitor-facing form state. The button still says the email was drafted, never that it was sent, because only the visitor can send the email.

Messages and provider delivery records may still be retained by the mailbox and providers; do not describe this as "no storage."

### Stored enquiry copies

`DATABASE_URL` enables one table, `enquiries`, created automatically on first use. A row holds the submitted fields, the arrival time, whether the email provider accepted the message, and salted one-way hashes of the caller address and of the message content. Raw addresses are never stored.

Storing is best effort and silent: it runs after the delivery attempt, never changes the response a visitor sees, and is skipped without comment when a copy would be a repeat of the same message within 24 hours, when the same caller already stored 3 copies in 15 minutes or 12 in a day, or when the table already received 60 copies in the last hour. This keeps the table useful for follow-up instead of a spam target. It is not a substitute for the required hosting-level rate limit on the endpoint.

Run `npm run enquiries` to print the most recent copies, or `npm run enquiries -- 50` for more. Keep the database credentials out of version control, and delete stored copies in line with the retention practice published in the privacy notice.

Endpoint storage still uses `DATABASE_URL`. Static GitHub Pages storage is separate: the browser writes directly to Supabase with a publishable key, and the `website_enquiries` table must allow `anon` INSERT while denying read/update/delete. The reference SQL is in `supabase/website_enquiries.sql`.

Successful submission means the email provider accepted the message, not that a person has read it or that inbox delivery is guaranteed. Automated tests mock delivery and never send live email.

## Deploying to GitHub Pages

`.github\workflows\deploy-pages.yml` builds the site and publishes the static output to Pages on the `jbautomate.ca` domain in `CNAME`. Pages serves files only, so the workflow uses `ENQUIRY_DELIVERY=email_app`. The browser writes valid enquiries directly to Supabase in the background with a publishable key, then uses the visitor's email application exactly as before. Configure `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` as GitHub Actions variables before deploying.

To run the endpoint and store enquiries in a deployment, host the site somewhere that executes server code (the Vercel adapter is already configured), set the delivery variables plus `DATABASE_URL` there, leave `ENQUIRY_DELIVERY` at `server`, and configure the required hosting-level rate limit for **POST `/api/contact`**.

## Before public deployment

1. Supply the actual domain and public contact address.
2. Decide how enquiries arrive. For a static deployment set `ENQUIRY_DELIVERY=email_app`, create the Supabase table from `supabase/website_enquiries.sql`, and set the two public Supabase build variables; then skip steps 3 and 4. For the endpoint, authenticate a sending domain in Resend and configure its API key, sender, and recipient as server-side environment variables.
3. Configure a platform-level rate-limiting rule for **POST `/api/contact`**. Use the hosting provider's firewall controls, a per-client/IP limit appropriate to genuine enquiries, and a blocking or throttling response. If the selected hosting plan does not support it, use a suitable upstream protection service before enabling the public form. Do not substitute an in-memory counter in the serverless function.
4. Set `CONTACT_RATE_LIMIT_CONFIGURED=true` only after confirming the rule exists.
5. Review the retention text in `src\content\site.ts` and the rest of the privacy page against the actual deployment, mailbox provider, and processors. Set `PRIVACY_NOTICE_APPROVED=true` only after that review.
6. Set `SITE_MODE=production`, run the configured checks and build, and confirm the enquiry path end to end: a controlled delivery check with synthetic content for the endpoint, or a drafted email for a static deployment.
7. Deploy only when authorized.

A production build is blocked while required values are missing or obvious placeholders remain. Build checks load the production `.env` files using Vite's environment precedence. Environment changes that affect public content require a new build.

Both marketing pages are pre-rendered; only the enquiry endpoint runs on demand. No accounts, CMS, subscriptions, payment system, analytics, or calendar embed are included.

## Security and operation

- Astro generates a content security policy with hashes for its scripts and styles.
- `vercel.json` supplies framing, content-type, referrer, permissions, and HTTPS transport headers.
- The contact endpoint validates and limits requests, checks the expected origin, and uses a honeypot. Deployment-level rate limiting is a separate, required operating responsibility.
- Do not add request-body logging, email-address logging, secret API keys, or detailed provider errors to the client. Supabase publishable keys are intentionally public and must be constrained with grants and RLS.
- Review failed delivery through sanitized operational logs and the provider's authorized dashboard. A website form is not a protected-data intake channel.
- Client application hosting, support hours, escalation, monitoring, and maintenance are separate engagement-specific agreements.

The Vercel routing utility currently pins an older `path-to-regexp`; the scoped package override uses the patched compatible 6.3.0 release. Review whether the override is still needed when upgrading the adapter.

## Assets

The wordmark, icon, workflow illustrations, and social-preview composition are original to this site. Manrope is self-hosted from `@fontsource-variable/manrope` under the SIL Open Font License; the license is included at `public\fonts\manrope-license.txt`. The "JB Automate" wordmark is set in Kode Mono, self-hosted from `@fontsource-variable/kode-mono` under the SIL Open Font License, with its license at `public\fonts\kode-mono-license.txt`; apply it with the `.wordmark` class wherever the business name is written. In the logo lockup the JB mark already carries the initials, so the wordmark beside it reads `Automate`; written mentions without the mark keep the full "JB Automate".

`public\images\social-card.svg` is the editable social-preview source; its PNG counterpart is the share-compatible export.

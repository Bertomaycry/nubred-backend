# Client user invite signup

Audience: frontend agent. Copy this file into the frontend repo.

Backend is implemented. Company accounts are created in the admin panel. Invited client users do not go through public signup or complete-onboarding. They land on `/accept-invitation`, set name / phone / password, then enter the workspace.

Passwords live in Clerk. This API never stores them and has no signup endpoint for this flow.

---

## 0. What the backend does now

`inviteClientUser` (`src/modules/client/provision.js`) creates a Clerk invitation with `notify: false` (Clerk does not email) and sends the link with Resend. The message includes the company name and the client role.

- `redirectUrl` = `{NUBRED_APP_ORIGIN}/accept-invitation?slug={slug}`
- `expiresInDays` = `2`
- `ignoreExisting` = `true`
- The email button is Clerk's `invitation.url`, not a link this API builds. Accept still lands on `/accept-invitation` with `__clerk_ticket`.

`NUBRED_APP_ORIGIN` defaults to `https://gov.nubred.com`. Local `.env` is `http://localhost:5173`. Staging must set this to the governance SPA host, not `https://{slug}.gov.nubred.com` (that host is the marketing site).

Clerk appends `__clerk_status` and `__clerk_ticket`. Example:

```
http://localhost:5173/accept-invitation?slug=test&__clerk_status=sign_up&__clerk_ticket=eyJ…
```

Invitations already sent keep their old 30-day expiry. Only new invites use 2 days. An expired ticket must not open the form (section 4.5).

`POST /api/auth/complete-onboarding` only sets `is_onboarded: true`. Do not route invited users there. Do not gate the app on `user.is_onboarded`.

---

## 1. End-to-end flow

```
Admin Add Client
  → platform DB: tenant + tenant_users (email, role, clerkUserId = null)
  → Resend email with the Clerk accept link (only if that email has no NuBred user yet)
  → user clicks Accept invitation
  → GET {APP_ORIGIN}/accept-invitation?slug={slug}
       &__clerk_status=sign_up|sign_in
       &__clerk_ticket=…
  → frontend finishes Clerk ticket (password form, or silent sign-in)
  → Clerk session
  → Clerk webhook user.created → platform users row
  → GET /api/auth/me
  → first tenant API call: attachTenant links tenant_users.clerkUserId by email
  → workspace for that slug
```

People who already have a NuBred account are **not** emailed. They log in as usual. The next tenant request links them by email.

---

## 2. Who does what

| Layer | Responsibility |
|---|---|
| Admin UI | Unchanged: create/edit client with emails + roles |
| Backend | Done. Redirect + 2-day expiry. Webhook and `attachTenant` unchanged |
| Frontend | New `/accept-invitation` page. Reuse current signup form **without email**. No onboarding page |
| Clerk production | When a production Clerk instance exists, add the exact app origin as a redirect URL. The current **Development** instance does not use that list, and **Allowed subdomains** stays off |

No new HTTP endpoint for “set password”.

---

## 3. Backend contract (already shipped)

Create and edit client both call `acceptInvitationUrl({ slug, companyName, roleLabel })`. `client` and `role` on the URL are labels only.

| Env | `NUBRED_APP_ORIGIN` |
|---|---|
| Local | `http://localhost:5173` |
| Staging | the governance SPA host |
| Prod | `https://gov.nubred.com` |

Still true:

- Emails that already have a NuBred `users` row are not invited. They sign in and are linked by email.
- Clerk webhook `user.created` writes first name, last name, email, and phone from `unsafeMetadata.phoneNumber`.
- `attachTenant` writes `tenant_users.clerkUserId` on the first authenticated tenant call.
- `GET /api/auth/me` still returns the user, including `is_onboarded`. Ignore that flag.
- There is no password or signup API for this flow.

Development Clerk instance: do not turn on **Domains → Allowed subdomains** (production-only, and this flow does not need it). Localhost redirects work without an allowlist. Add the exact app origin only on a future production Clerk instance.

---

## 4. Frontend

### 4.1 Route

`/accept-invitation`

Public. No auth layout. If there is no `__clerk_ticket`, show “This invitation link is invalid or has expired.” Do not show the form.

Read:

| Query | Use |
|---|---|
| `slug` | Workspace to open after success. Send as `X-Tenant-Slug` |
| `client` | Company name. Display only: "You have been invited to join {client} as {role}." |
| `role` | Role label (`Owner`, `Project Manager`, …). Display only |
| `__clerk_ticket` | Clerk ticket. Required |
| `__clerk_status` | `sign_up` (form) or `sign_in` (no form) |

### 4.2 Reuse the current signup screen

Same visual as the existing Sign Up: card, first / last name, phone with country code, password, repeat password, primary button.

**Hide**

- Email (ticket already has it)
- “Already have an account? Login Now”
- Google / social

**Keep**

- First name, last name (required)
- Phone (same as today’s signup; stored on Clerk as `unsafeMetadata.phoneNumber` so the webhook copies it)
- Password + repeat password (repeat is client-side only)

Button label: `Create account` or keep `SIGN UP`.

### 4.3 `__clerk_status=sign_up`

Clerk JS, not this API:

```ts
const ticket = searchParams.get("__clerk_ticket");
const slug = searchParams.get("slug");

const signUp = await clerk.signUp.create({
  strategy: "ticket",
  ticket,
  firstName,
  lastName,
  password, // the value, not the repeat field
  unsafeMetadata: { phoneNumber }, // E.164, same as current signup
});

if (signUp.createdSessionId) {
  await clerk.setActive({ session: signUp.createdSessionId });
} else {
  // unexpected — invitation tickets normally create a session immediately
  show signUp.missingFields / error
}
```

Do not pass `emailAddress`. Do not call `POST /api/auth/*` for this.

Then:

1. `GET /api/auth/me` (Bearer = new Clerk session)
2. Go to the tenant app for `slug`. Send `X-Tenant-Slug: {slug}` on API calls.
3. Do **not** go to complete-onboarding. Do **not** read `is_onboarded`.

Webhook may lag a few hundred ms. If `/api/auth/me` 401s once, retry once after ~500 ms (`attachUser` can create the row if the webhook has not arrived).

### 4.4 `__clerk_status=sign_in`

This email already has a Clerk user. No form.

```ts
const signIn = await clerk.signIn.create({
  strategy: "ticket",
  ticket,
});
await clerk.setActive({ session: signIn.createdSessionId });
```

Then the same `/me` + workspace redirect as 4.3.

### 4.5 Errors

| Case | UI |
|---|---|
| Missing/expired/used ticket | “This invitation link is invalid or has expired. Ask your administrator to add you again.” The link lasts 2 days. |
| Password too weak (Clerk) | Show Clerk’s message under password |
| Repeat password mismatch | Client-only, before submit |
| Phone taken | Account is still created; phone may be omitted. Do not block signup |
| Restricted client after login | API `403` “This workspace has been restricted.” Show that. Do not retry signup |

### 4.6 After login (existing users, no email)

Admin added an email that already exists → no invitation. They use the normal Login page, then the workspace. Frontend does nothing special. `attachTenant` links by email.

### 4.7 Router / guards to remove for this path

- Do not redirect invited users to `/complete-onboarding` or `/onboarding`
- Do not block the app when `user.is_onboarded === false` after this flow
- Do not send them through public `/sign-up` (no ticket → would create an unbound Clerk user)
- Public “Request Access” / inquiry stays as it is. That is not client-user invite

Axios: after accept-invitation, include `X-Tenant-Slug` from `slug`. Admin routes still omit it.

---

## 5. Data that already exists vs what the form collects

| Data | Source |
|---|---|
| Company name, slug, modules, max projects | Admin create-client |
| Client role (`owner`, `project_manager`, …) | Admin create-client → `tenant_users.role` |
| Email | Admin create-client → Clerk invitation → ticket |
| First name, last name, phone, password | Accept-invitation form → Clerk → webhook copies name/phone onto `users` |

`users.role` stays `"user"`. Client role is only on `tenant_users`.

---

## 6. Acceptance

**Backend (done)**

- [x] Invitation redirect is `{NUBRED_APP_ORIGIN}/accept-invitation?slug={slug}`
- [x] Create and edit client both use that URL
- [x] `expiresInDays` is 2
- [x] Existing NuBred emails still get no invitation

**Frontend**

- [ ] `/accept-invitation` reads ticket + slug
- [ ] Form is current signup UI minus email, login link, and Google
- [ ] `sign_up` ticket + password creates a session without an API signup call
- [ ] `sign_in` ticket signs in with no form
- [ ] Success → workspace for `slug`, not onboarding
- [ ] Expired ticket shows the expired copy
- [ ] Local: invite a throwaway email, click the Clerk mail, set password, land in the tenant app

---

## 7. Out of scope

- MinIO CORS / `https://{slug}.gov.nubred.com` (separate)
- Changing Clerk email HTML
- Tenant-side “submit a filter” UI
- Public consultant/company self-signup

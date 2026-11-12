# Client user invite signup

Audience: frontend agent. Backend is implemented.

Nobody is a member of a client until they click **Accept invitation**. New and existing people are both stored as pending invites. Passwords stay in Clerk. This API has no signup endpoint.

`POST /api/auth/complete-onboarding` only sets `is_onboarded`. Do not route invited users there. Do not gate the app on `user.is_onboarded`.

## Admin API

Create and edit request bodies are unchanged. `users` is the full desired list `[{ email, role }]`, including people who have not accepted. Leaving a pending email out revokes that invite.

`GET /api/admin/clients/:id`

- `users` — members who have joined, with usage. This is the usage chart.
- `usersCount` — `users.length` only. A new client is `0` until someone accepts.
- `pendingInvites` — `[{ email, role, expiresAt }]`. `expiresAt` is ISO. The invite lasts 2 days.
- `email` — the owner address, including an owner who is still pending.

Build the edit form from `users` plus `pendingInvites`. Submit the combined list as `users`. Show pending rows as Pending. Saving a pending email again does not send a second email. A role change on that row is saved.

`inviteFailures` is present only when an email could not be sent. That address is not pending.

## Accept page

`/accept-invitation` is public, outside the admin layout.

| Param | Use |
|---|---|
| `slug` | Client to join. Send as `X-Tenant-Slug` after accept |
| `client` | Company name, display only |
| `role` | Role label, display only |
| `__clerk_ticket` | Required |
| `__clerk_status` | `sign_up`, `sign_in`, or `complete` |

No ticket: "This invitation link is invalid or has expired. Ask your administrator to add you again."

If a different person is already signed in, `clerk.signOut({ redirectUrl })` back to this page's path and query. Do not send them to `/admin/login`.

- `sign_up`: signup form without email, Google, or the login link. `signUp.create({ strategy: "ticket", ticket, firstName, lastName, password, unsafeMetadata: { phoneNumber } })`, then `setActive`.
- `sign_in`: no form. `signIn.create({ strategy: "ticket", ticket })`, then `setActive`.
- `complete`: already this person. Continue.

Then, with the Bearer token:

`POST /api/invitations/accept`

```json
{ "slug": "test" }
```

Do not send `X-Tenant-Slug` on this call.

`200` `{ "success": true, "message": "You have joined this client.", "data": { "slug": "test", "role": "project_manager" } }`

Calling it twice is success. Then `GET /api/auth/me` (retry once if it 401s) and open that client's workspace.

| Failure | UI |
|---|---|
| Clerk `invitation_already_accepted` | "This invitation was already used. Sign in instead." |
| `404` `Invitation not found.` | That text |
| `410` | "This invitation link is invalid or has expired. Ask your administrator to add you again." |
| `403` `This workspace has been restricted.` | That text |
| Weak password | Clerk's message |

`role` in the accept response is the stored role (`project_manager`), not the label. Workspace requests after this send `X-Tenant-Slug` from `slug`.

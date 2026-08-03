# Create your login, then lock the door

Right now no account exists, and new signups would be stuck waiting on a confirmation email. This sets up your single account and then closes registration so nobody else can get in.

## What happens, in order

1. **Turn off email confirmation.** You'll be signed in the instant you create the account — no inbox round-trip.
2. **You create your account.** On the landing page, switch to "Create account", enter the email and password you want, and submit. You land straight in the real app.
3. **I close signups.** Once you confirm you're in, registration is disabled at the backend, so a signup attempt from anyone else is rejected even if they hit the API directly.
4. **The landing page drops the signup option.** It becomes a sign-in-only form plus the "View Demo" button. No "Create account" toggle, no way for a visitor to guess there ever was one.

## Choosing your credentials

- Your username is your email address — that's how the login works. Any real address you own is fine; it doesn't need to receive mail since confirmation is off.
- Pick a strong password and store it in a password manager. With signups closed and no email confirmation, there's no self-service reset — if it's lost I'd have to reset it for you from the backend.

## Technical notes

- Auth config: `auto_confirm_email: true`, then `disable_signup: true` after your account exists. Anonymous sign-ins stay off.
- `src/routes/index.tsx`: remove the signin/signup mode toggle and the `supabase.auth.signUp` branch; keep `signInWithPassword`, the error states, and the "View Demo" button untouched.
- No database or RLS changes. The `_authenticated` gate, the `requireSupabaseAuth` middleware on the live API server functions, and demo mode all stay exactly as they are.
- Password strength checking against known-breached passwords can be switched on at the same time if you want it — say the word and I'll include it.

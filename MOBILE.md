# DeuceIQ mobile app

One app uses the existing authenticated club membership and permission-filtered navigation. Members, staff and professionals retain their existing screens and backend permissions. Neither a URL nor a mobile role picker grants access.

## Local development

Run `npm run dev:mobile` and open http://127.0.0.1:5174/?mobile_preview=1 to preview the phone navigation. Use a narrow browser viewport and the normal login. This is a browser preview, not a device test.

`npm run build:mobile` builds the same React app in mobile mode. Public frontend configuration must include VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. VITE_API_BASE must target the intended HTTPS backend. Do not use Stripe secret keys, Supabase service-role credentials, OpenAI keys or backend environment files in the frontend. The mobile build rejects an HTTP or localhost API destination.

Run `npm run mobile:sync` after building; then `npm run mobile:android` or `npm run mobile:ios` opens the native project. Android requires Android Studio, its SDK and a compatible Java installation. iOS requires macOS and Xcode. Signing and store submission are not configured.

The provisional application identifier is com.deuceiq.app. Confirm ownership and the final identifier before configuring signing, push notifications or store accounts.

## Server configuration before device testing

Deploy the backend CORS change for the exact app origins capacitor://localhost, https://localhost and http://localhost. Authentication and authorization remain required for every protected endpoint. CORS is not authentication.

Use the same Supabase project and HTTPS API as the intended testing environment. Keep test Stripe mode enabled during development. Password-reset and invitation email links use the public website in a native build. Allow the existing public callback URLs in Supabase.

Stripe-hosted card setup and club onboarding open in the native browser. Their current return URLs still go to app.deuceiq.com. Close that browser and return to the app to refresh status. There is no automatic verified universal-link return yet. Recovery payments involving Stripe Payment Element redirects also need device validation before release.

## Implemented in this local foundation

- Bundled React assets in Android and iOS projects instead of a production server URL inside the WebView.
- Role-filtered bottom tabs and a More menu containing all permitted screens and sign out.
- Safe-area spacing and readable mobile navigation.
- Native resume and browser-close events refresh existing focus-based data loaders.
- Android back returns to Home, respects open dialogs, or minimizes the app from Home.
- Stripe links validated before opening the native browser.
- Web email callback URLs remain valid in the native runtime.

## Remaining release work

- Actual Android and iPhone builds, device testing and all role/club-switch workflows.
- Production app icon, launch assets, signing, versioning and verified app links.
- Native callback handling for authentication and payment return flows.
- Secure native credential persistence review and expired-session handling tests.
- Push notifications, opt-in preferences and authenticated device-token registration.
- Account deletion, privacy/data disclosures, chat reporting/blocking/moderation and store policy review.
- Connectivity/retry UX, accessibility, keyboard behavior and payment recovery testing.
- Store accounts, review login, screenshots, TestFlight/Play testing and submission.

Nothing in this foundation publishes an app, deploys the backend or changes payment mode.

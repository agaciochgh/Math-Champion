# Family sync

Math Champion uses **the same Firebase project as Reading Quest** (`reading-quest-8aee7`), so there is nothing new to set up in Firebase:

- Your family account (email and password) works in both apps.
- Math Champion stores its data separately, under `families/{your account}/math/…`. Reading Quest uses `families/{your account}/data/…`. Neither app can see or change the other's data.
- The security rules you already published (`firestore.rules`) cover both apps: only your signed-in family account can read or write its data.
- `agaciochgh.github.io` is already on the Firebase **Authorized domains** list, and Math Champion is served from the same address.

## Using it

1. On her tablet, open Math Champion and tap **Sign in to your family account** on the first screen, or go to **Grown-ups → Settings → Family sync**. Sign in with your Reading Quest family email and password.
2. Do the same on your own phone. Open **Grown-ups → Report** to see her practice.
3. Changes show up on other devices within a second or two. Practice done offline uploads once the device is back online.

If you created kids or did practice on a device before signing in, it gets merged into the family account when you sign in.

## The parent PIN

The first time anyone opens **Grown-ups**, the app asks for a new 4-digit PIN. The PIN syncs to all signed-in devices. The grown-ups area locks when you tap **🔒 Lock**, after 2 minutes without a tap, or when you switch away from the app. If you forget the PIN, tap **Forgot?** and answer the grown-up multiplication question, then set a new PIN in Settings.

The PIN is a kid-proof lock, not bank-grade security. Your family account password is what protects the data itself.

## Want a separate Firebase project instead?

Follow Reading Quest's SYNC-SETUP.md steps to create a new project. Then replace the values in `sync-config.js` with the new project's settings, or paste them to Claude and ask for the change.

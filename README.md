# cinderella

A local macOS screen recorder with named profiles and optional Google Drive upload. Work and Personal are created on first launch. Each profile can use its own Google account and folder, or share a connected account with other profiles.

## Run locally

Use Node 24 and pnpm 10. From this directory run:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Choose a profile, click **Choose screen or window**, select the capture source, and start recording. Allow macOS Screen Recording access for Electron when prompted and relaunch if macOS requests it. Enable microphone access to include narration. Stop the recording to preview it. Local WebM files and the SQLite library are stored under Electron's user-data directory (normally `~/Library/Application Support/cinderella` on macOS).

## Connect Google Drive

In a Google Cloud project, enable Google Drive API and Google Picker API. Configure the OAuth consent screen. For an external app in testing, add each Google account as a test user. Create a **Desktop app** OAuth client and an API key restricted to the Google Picker API. Copy the numeric project number from the same project.

Export these variables in the shell that starts the app:

```sh
export GOOGLE_CLIENT_ID='your-desktop-client-id'
export GOOGLE_CLIENT_SECRET='your-desktop-client-secret'
export GOOGLE_PICKER_KEY='your-picker-api-key'
export GOOGLE_PROJECT_NUMBER='your-numeric-project-number'
pnpm start
```

Click **Connect Google account** to sign in through your browser. Select a connected account and click **Choose folder** to apply the destination to the current profile. The app requests per-file Drive access. It encrypts refresh tokens using Electron safeStorage and the macOS Keychain.

**Save to Drive** streams the local file directly to Google. Recordings keep the destination selected at capture time. For a recording made without a destination, the first upload uses its profile's configured folder. An interrupted upload can be retried. **Copy link** copies the Drive viewing URL. **Open in Drive** opens the file where you can change sharing permissions.

## Check the slices

Run `pnpm test` and `pnpm build`. Automated tests exercise profile persistence, recording storage and recovery, destination isolation, and upload retry with a simulated Drive service.

For a desktop smoke test, add a profile, rename it, restart, and confirm its name. Record a screen with microphone enabled, stop, and play back the result. Connect two Google accounts, choose a different destination in each profile, and upload a short recording from each. Verify each file's folder and sharing settings in Drive.

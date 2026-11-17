# glint

A local macOS screen recorder with named profiles and optional Google Drive upload. Work and Personal are created on first launch. Each profile can use its own Google account and folder, or share a connected account with other profiles.

## Run locally

Use Node 24 and pnpm 10. From this directory run:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Choose a profile, click **Choose screen or window**, select the capture source, and start recording. Allow macOS Screen Recording access for Electron when prompted and relaunch if macOS requests it. Enable microphone access to include narration. Stop the recording to open its video page. Local WebM files and the SQLite library are stored under Electron's user-data directory (normally `~/Library/Application Support/glint` on macOS). Existing installations continue using their original library location.

### Capture preview and recording

A reported issue showed “The capture source closed” immediately after pressing Start, sometimes with a missing thumbnail. glint now opens a muted preview when you select a source and records from that same stream. Press **Start recording** to prepare the microphone and hide the studio for a three-second countdown. Press **Esc** or click **Cancel** to return to the preview. Recording begins when the countdown finishes. The menu bar shows a red dot and elapsed time. Choose **Stop recording** there or press **⌘⇧9** when the shortcut is available.

## Connect Google Drive

Choose your Google account under the profile’s destination. The first time, click **Connect Google Drive** and sign in. Choosing or connecting an account saves the profile’s destination immediately. glint creates or reuses a folder named after the profile in My Drive, then shows its name and account. Use **Change → Change folder…** to pick an existing folder instead. The app requests per-file Drive access. It encrypts refresh tokens using Electron safeStorage and the macOS Keychain.

Enable **Auto-upload new recordings** after choosing a folder. This preference belongs to the profile. glint saves each recording locally, then uploads it in the background. Pending uploads resume when glint reopens. If an upload fails, use **Retry Drive upload** in the recording library.

Each profile also has a sharing preference for new recordings. **Private · only me** requires a folder owned by you with owner-only access. If glint cannot verify that, the recording stays local and its video page explains why. **Use folder access** allows the recording to inherit access from the destination. **Anyone with the link** requests view access without search discovery. Drive administrators can restrict sharing.

### Recording page

Stop a recording or choose **View recording** in the library. The page plays the local copy immediately, tracks upload progress, and shows the link audience reported by Drive. **Copy link** copies the Drive viewing link in one click. Drive exposes video metadata but does not provide a definitive playback-ready flag. Use **Open in Drive** to check the player.

Use **Add title** to name the recording in glint. Future uploads use the saved title. Drag the edges of the filmstrip in **Trim clip**. Click the frames to scrub or select **Preview clip** to play the range. Focus either edge and use the arrow keys for fine adjustments. **Save clip as copy** creates a separate recording in the same profile. Trimming uses FFmpeg with VP9 and Opus support from PATH or a standard Homebrew installation. The **Recording issues** section includes saved capture, upload, and sharing errors when available.

**Save to Drive** streams the local file directly to Google. Recordings keep the destination selected at capture time. For a recording made without a destination, the first upload uses its profile's configured folder. An interrupted upload can be retried. **Copy link** copies the Drive viewing URL. **Open in Drive** opens the file where you can change sharing permissions.

## Publisher and source-build setup

Official downloads carry glint’s desktop OAuth configuration. Users sign in to their own Google accounts in their browsers. Developers running from source and maintainers of independent distributions can supply their own project settings.

In a Google Cloud project, enable Google Drive API and Google Picker API. Configure the OAuth consent screen. For an external app in testing, add each Google account as a test user. Create a **Desktop app** OAuth client and an API key restricted to the Google Picker API. Copy the numeric project number from the same project.

For local development, copy `.env.example` to `.env` in the project root and fill in the four Google settings. Restart `pnpm start` after editing the file. Shell variables take precedence. The local file is ignored by Git.

For a public release, use a production Desktop OAuth client, configure the consent screen for external users, and complete Google’s applicable publishing requirements. Supply all four settings from release secrets and run `pnpm package:mac` on a Mac. This builds a ZIP for the current architecture in `release/`. The package command requires all four settings and includes only those settings in the app. Runtime environment overrides must belong to one project. Local recording works without Google configuration.

Desktop clients are inspectable. Keep production configuration out of Git and restrict the Picker key to the Picker API. User refresh tokens are issued separately per account. Public macOS distribution also requires your normal Developer ID signing and notarization process; the packaging command alone does not notarize the app.

## Check the slices

Run `pnpm test` and `pnpm build`. Automated tests exercise profile persistence, recording storage and recovery, destination isolation, and upload retry with a simulated Drive service.

For a desktop smoke test, add a profile, rename it, restart, and confirm its name. Record a screen with microphone enabled, stop, and play back the result. Connect two Google accounts, choose a different destination in each profile, and upload a short recording from each. Verify each file's folder and sharing settings in Drive.

Each profile remembers its recording microphone and whether microphone capture is on. Choose **System default** to follow the computer’s input setting. If a preferred input is unavailable, glint tries the system default and remembers the preferred input for later recordings.

In the destination panel, open **Manage accounts** to reconnect an email or disconnect it from glint. Disconnecting clears the saved Drive destination and turns off auto-upload for every profile using that account.

### Camera and recording controls

After selecting a screen or window, turn on **Camera bubble** and drag on the preview to place it. During recording you can drag the dot in the floating toolbar or choose a corner from the menu bar. The camera is composited into the saved video.

Drag the floating toolbar by its grip. Use **Pause**, **Resume**, **Stop**, or **Hide**. The menu bar can restore the toolbar. Floating controls default to visible for a window capture and hidden for a whole display, where macOS can capture floating windows.

### Editing and managing a recording

Choose **Full-screen editor** above the video for a larger view with the timeline. Choose **Cut sections**, mark a range, then **Add cut**. Add more ranges or click a range’s × to undo it. **Preview clip** skips marked sections. **Save clip as copy** exports the edit with its audio.

Use **Change link access** on an uploaded recording to grant anyone-with-link viewing or remove that file’s public link grant. Folder permissions and organization policies still apply. **Delete recording** moves the local video to the Mac’s Trash. Select the separate Drive option to also move its upload to Drive Trash.

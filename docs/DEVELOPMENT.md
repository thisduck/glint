# Developing glint

Building, testing and releasing glint. For what glint does, see the [README](../README.md).

## Run locally

Use Node 24 and pnpm 10. From this directory run:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Recordings and the SQLite library live under Electron's user-data directory (normally `~/Library/Application Support/glint` on macOS). Existing installations continue using their original library location. Trimming and clip export use FFmpeg with VP9 and Opus support from PATH or a standard Homebrew installation.

## Publisher and source-build setup

Official downloads carry glint’s desktop OAuth configuration. Users sign in to their own Google accounts in their browsers. Developers running from source and maintainers of independent distributions can supply their own project settings.

In a Google Cloud project, enable Google Drive API and Google Picker API. Configure the OAuth consent screen. For an external app in testing, add each Google account as a test user. Create a **Desktop app** OAuth client and an API key restricted to the Google Picker API. Copy the numeric project number from the same project.

For local development, copy `.env.example` to `.env` in the project root and fill in the four Google settings. Restart `pnpm start` after editing the file. Shell variables take precedence. The local file is ignored by Git.

For a public release, use a production Desktop OAuth client, configure the consent screen for external users, and complete Google’s applicable publishing requirements. Supply all four settings from release secrets and run `pnpm package:mac` on a Mac. This builds a ZIP and a drag-to-Applications DMG for the current architecture in `release/`. The package command requires all four settings and includes only those settings in the app. Runtime environment overrides must belong to one project. Local recording works without Google configuration.

Desktop clients are inspectable. Keep production configuration out of Git and restrict the Picker key to the Picker API. User refresh tokens are issued separately per account. Public macOS distribution also requires your normal Developer ID signing and notarization process; the packaging command alone does not notarize the app.

## Build and release on GitHub

[Build glint for macOS](https://github.com/thisduck/glint/actions/workflows/build-macos.yml) runs the tests and builds the app on pushes to main and on pull requests. Changing the version in `package.json` on main automatically builds, signs, notarizes, and publishes the Apple Silicon DMG to [GitHub Releases](https://github.com/thisduck/glint/releases/latest). For a manual build, select **Run workflow** on **main** and pick a build type. The default is **Release**.

| Build type | Result |
| --- | --- |
| Preview | An ad-hoc signed DMG under the run’s **Artifacts**. macOS may require approval to open a downloaded preview. |
| Signed test | A Developer ID signed, notarized DMG under **Artifacts**. |
| Release | The same signed and notarized DMG on the public Releases page, tagged with the version in `package.json`. Set a fresh version on main before each release. |

Set the four Google values from `.env.example` in the repo’s [Actions secrets](https://github.com/thisduck/glint/settings/secrets/actions). Signed builds also use the following secrets, with the same names and formats as unsound.

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | Base64 of a Developer ID Application .p12 export containing the certificate and private key |
| `APPLE_CERTIFICATE_PASSWORD` | Password used to protect that export |
| `APPLE_SIGNING_IDENTITY` | Full Developer ID Application identity from Keychain Access |
| `APPLE_API_KEY` | App Store Connect API key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_API_KEY_CONTENT` | Original multiline .p8 private key for that key ID |

## Check the slices

Run `pnpm test` and `pnpm build`. Automated tests exercise profile persistence, recording storage and recovery, destination isolation, and upload retry with a simulated Drive service.

For a desktop smoke test, add a profile, rename it, restart, and confirm its name. Record a screen with microphone enabled, stop, and play back the result. Connect two Google accounts, choose a different destination in each profile, and upload a short recording from each. Verify each file's folder and sharing settings in Drive.

## Future editable recordings

glint currently exports a single WebM with the camera composited into the screen and the audio mixed. The screen and camera enter the compositor as separate streams. A future editable recording can retain those sources alongside the shareable WebM. Cursor movement, camera framing, and input toggles would need timestamped events on the same recording timeline, accounting for pauses. Existing WebMs contain only the rendered result.

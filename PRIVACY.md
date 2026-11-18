# glint privacy policy

Effective November 17, 2026

glint is a desktop screen recorder. You can record, play, and edit videos locally without connecting a Google account.

## What stays on your Mac

glint saves the screen or window you record, along with any camera, microphone, or system audio you enable. Its local library stores recording titles, thumbnails, profile settings, and upload status. The maintainers do not receive a copy of your recordings when you use the app.

## App updates

The installed app contacts GitHub to check for new versions and download updates. GitHub receives ordinary web request information such as your IP address. Update requests do not include recordings or Google account details. You can turn off automatic checks in the glint menu bar panel.

## What happens when you connect Google Drive

You sign in through Google. glint uses your Google account ID and email address to show the connected account and send each profile’s uploads to the right place. It stores those identifiers on your Mac and uses macOS Keychain-backed encryption to protect the saved refresh token that lets it upload while you are signed in.

glint requests per-file Drive access (`drive.file`). It uses that access to create a destination folder or use one you select, upload recordings, check file status and permissions, and apply your sharing or deletion choices. When you upload manually or enable auto-upload, glint sends the recording and its file name directly from your Mac to Google Drive. People who can view it depend on the file and folder permissions in Drive. If you choose **Anyone with the link**, anyone who receives that link may be able to watch.

glint uses Google data only to provide these features. It does not sell Google user data or use it for advertising. Its use and transfer of information received from Google APIs follows the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## Retention and deletion

- **Recordings:** Local recordings remain on your Mac until you delete them. Deleting a recording in glint moves the local file to the Mac’s Trash. You can separately choose to move its uploaded copy to Drive Trash. Each trash has its own retention settings.
- **Account access:** Disconnecting an account in glint removes its saved sign-in token and disables auto-upload for profiles using that account. Existing uploads stay in Drive with their current sharing settings. You can also revoke glint’s access in [Google Account connections](https://myaccount.google.com/connections).
- **Local library:** To remove all glint data from your Mac, quit glint and remove its application-data folder, including the recording files and library database. This leaves copies you exported or uploaded under your control.

## Contact

For privacy questions, contact the maintainers through [glint’s issue tracker](https://github.com/thisduck/glint/issues). Issues are public. Keep recordings, account details, and private sharing links out of your post.

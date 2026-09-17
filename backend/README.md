# AirIndia remote support API

Node.js/Express + Supabase backend for the AirIndia web dashboard and Flutter Android remote-support client.

## Flutter compatibility added

The original authenticated website routes and Socket.IO behavior remain available. The following mobile routes now also support the Flutter app through a revocable `X-Device-Token`:

- `POST /api/devices/register`
- `GET /api/devices/:deviceId/sessions/pending`
- `POST /api/sessions/:sessionId/accept`
- `POST /api/sessions/:sessionId/reject`
- `GET /api/sessions/:sessionId/signals?after=:cursor`
- `POST /api/sessions/:sessionId/signals`
- `POST /api/sessions/:sessionId/end`

The existing website/operator routes continue to use Supabase `Authorization: Bearer <access-token>` authentication.

## Required deployment order

1. In Supabase SQL Editor, run:

   `supabase/migrations/20260909_flutter_device_credentials.sql`

2. Add the variables from `.env.example` to the server/Vercel environment. Set a new random `DEVICE_TOKEN_SECRET` of at least 32 characters.
3. Use Node.js 22 or newer, then install and validate:

   ```bash
   npm ci
   npm run check
   npm test
   ```

4. Deploy the API, then build the Flutter app with the deployed `/api` URL:

   ```bash
   flutter build apk --release \
     --dart-define=API_BASE_URL=https://your-backend.example/api
   ```

## Security behavior

- Raw device tokens and six-digit security codes are never stored in the database.
- Registration is rate-limited, and an existing installation must present its original security code before its device token can rotate.
- A device token is bound to exactly one active device and workspace.
- Mobile session access is limited to sessions belonging to that device.
- Removing a device from the web dashboard also revokes its Flutter device credential.
- Accept/Reject remains an explicit phone-owner action; signaling is unavailable until the session is accepted.

Do not commit or share a real `.env` file. Production secrets belong in the hosting provider's encrypted environment settings.

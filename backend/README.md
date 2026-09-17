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

## Production WebRTC / Vercel

The Flutter client can use this production API base URL:

```text
https://backend-dusky-three-94.vercel.app/api
```

WebRTC media is peer-to-peer. This backend handles session state and signaling (offer, answer, and ICE candidates). Socket.IO is also attached to the exported HTTP server for realtime browser/operator events; the Flutter device signaling endpoints additionally work over REST, so signaling does not depend only on a persistent socket.

For reliable calls across mobile networks, configure a TURN service in the Flutter/browser WebRTC peer configuration. STUN alone cannot relay media when direct peer connectivity is blocked. TURN credentials should be supplied through deployment/build configuration, not committed to Git.

Required Vercel environment variables include `DEVICE_TOKEN_SECRET` in addition to the other values in `.env.example`.

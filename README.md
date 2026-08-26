# AirLink — Database-Driven Remote Support

AirLink is a consent-first remote-support stack using React/Vite, Node/Express, Supabase and React Native/Expo Android.

## Final product flow

```text
Android
Install app
   ↓
Log in / Sign up
   ↓
6-digit AirLink app PIN setup/unlock
   ↓
Application opens
   ↓
Phone auto-registers in trusted support workspace
   ↓
Web Devices page shows phone

Session
Web: Request access
   ↓
Supabase remote_sessions.status = requested
   ↓
Android fetches requested row from API/database
   ↓
Visible Accept / Decline
   ↓ Accept
status = approved
   ↓
Approved WebRTC peer + Android MediaProjection start
   ↓ WebRTC connected
status = active
   ↓
Live screen + approved remote gestures
   ↓ End/Remove
status = terminated
```

**Supabase/PostgreSQL is the session source of truth.** Socket.IO only tells clients to refresh faster. Both Android and Web include database/API fallback reads, so a missed realtime event does not become a missed support request.

There is no user-facing pairing/device code. Automatic device registration does not grant remote access.

## Device removal

Web Devices now includes a Remove button. Removal is a soft revocation so audit/session history remains available:

- `devices.revoked_at`, `revoked_by`, `revoke_reason` are stored.
- Revoked devices disappear from normal Web device lists.
- Any requested/approved/active session is terminated.
- Backend emits `device:removed` as a fast notification.
- Android clears local device/session state and stops screen sharing/control.
- If realtime is missed, registration/presence/session APIs return HTTP 410 and Android clears the device state then.
- A revoked phone is not silently auto-created again on the next heartbeat/login.

## Consent and Android safety

- Every new support request requires visible Accept / Decline on Android.
- Android Accessibility must be enabled manually by the device owner once.
- MediaProjection uses Android's visible screen-capture permission flow.
- Remote input only runs while the database session is `active` and `approved_permissions.remote_input === true`.
- The phone owner can terminate a session at any time.
- Removing a device does not silently alter Android Accessibility settings; it revokes AirLink's device association/session access.

## Repository

```text
AirLink/
├── frontend/       React/Vite dashboard
├── backend/        Node/Express API + Socket.IO
├── mobile/         React Native/Expo Android source + native patch files
└── supabase/
    └── migrations/
        ├── 20260811_000001_airlink_backend.sql
        ├── 20260811_000002_mobile_security.sql
        ├── 20260817_000003_direct_mobile_enrollment.sql
        └── 20260819_000004_database_session_device_lifecycle.sql
```

## 1. Supabase migrations

For a fresh database, apply all migrations in filename order.

For the existing AirLink database, make sure these later migrations are applied after the original backend migration:

```text
20260811_000002_mobile_security.sql
20260817_000003_direct_mobile_enrollment.sql
20260819_000004_database_session_device_lifecycle.sql
```

The final migration implements the database-authoritative lifecycle and device revocation rules.

## 2. Backend environment

Create `backend/.env` from `.env.example`:

```env
NODE_ENV=development
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DEVICE_REGISTRATION_WORKSPACE_ID=YOUR_WEB_SUPPORT_WORKSPACE_UUID
MOBILE_UNLOCK_SECRET=replace-with-a-random-secret-at-least-32-characters
```

`SUPABASE_SECRET_KEY`, `DEVICE_REGISTRATION_WORKSPACE_ID` and `MOBILE_UNLOCK_SECRET` are backend-only values.

## 3. Mobile environment

`mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://<PC_LAN_IP>:4000/api
```

For USB-only development you may use `127.0.0.1` only when `adb reverse tcp:4000 tcp:4000` is active.

After changing `EXPO_PUBLIC_*`, restart Metro with cache clear.

## 4. PIN flow

Mobile account security endpoints:

```text
GET   /api/mobile/security/status
POST  /api/mobile/security/setup
POST  /api/mobile/security/unlock
POST  /api/mobile/security/backup-codes
PATCH /api/mobile/security/pin
```

The PIN itself is never stored as plaintext. Backend uses scrypt hashes and server-only temporary unlock tokens. Backup codes are one-time recovery codes.

The navigation order is:

```text
No account session -> Login / Sign up
Account + no PIN    -> PIN setup
Account + locked    -> PIN unlock
Unlocked            -> device/application layer
```

## 5. Session API

Operator:

```text
GET    /api/workspaces/:workspaceId/devices
DELETE /api/devices/:deviceId?workspaceId=<uuid>
POST   /api/devices/:deviceId/sessions
GET    /api/devices/:deviceId/open-session?workspaceId=<uuid>
GET    /api/sessions/:sessionId
POST   /api/sessions/:sessionId/end
```

Android:

```text
POST /api/device/register
POST /api/device/presence
GET  /api/device/sessions?deviceId=<uuid>&limit=60
GET  /api/device/sessions/pending?deviceId=<uuid>
POST /api/sessions/:sessionId/respond
POST /api/sessions/:sessionId/start
POST /api/sessions/:sessionId/end
```

`/respond` writes requested -> approved/declined. Android starts WebRTC from the approved database row. When its WebRTC peer reaches `connected`, `/start` writes approved -> active.

## 6. Android native module

Custom native files are under:

```text
mobile/native-android-files/
```

Apply them to the existing generated `mobile/android` project with:

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\APPLY_NATIVE_PATCH.ps1
```

**Do not run `npx expo prebuild --clean` on the working custom-native project unless you are intentionally regenerating Android and will reapply the native patch.**

If the patch script leaves `.bak` files inside `android/app/src/main/res`, delete those resource backups before Gradle build because Android resources must end in `.xml`.

Build for the physical ARM64 phone:

```cmd
cd mobile\android
gradlew.bat app:assembleDebug -x lint -x test --console=plain -PreactNativeArchitectures=arm64-v8a
```

Install:

```cmd
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

## 7. Local run

Backend:

```cmd
cd backend
node src\server.js
```

Frontend:

```cmd
cd frontend
npm run dev
```

Metro/dev client:

```cmd
cd mobile
npx expo start --dev-client --lan --port 8081 --clear
```

Optional USB reverse:

```cmd
adb reverse tcp:8081 tcp:8081
adb reverse tcp:4000 tcp:4000
```

## 8. End-to-end test

```text
1. Android: Sign up or log in.
2. New account: create 6-digit PIN; existing account: enter PIN.
3. Application opens and phone auto-registers.
4. Web → Devices shows the phone.
5. Web clicks Request support session.
6. Database row becomes requested.
7. Android database polling/realtime refresh finds the row and shows Accept / Decline.
8. Tap Accept → database row becomes approved.
9. Browser and phone establish WebRTC; Android shows MediaProjection prompt when required.
10. WebRTC connected → Android calls /start → database row becomes active.
11. Web shows live screen; approved tap/swipe controls work.
12. End from either side → database row becomes terminated.
13. Web Remove Device → device disappears from Web, active/open sessions terminate, Android clears its AirLink device identity.
```

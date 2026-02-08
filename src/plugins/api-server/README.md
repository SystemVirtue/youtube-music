# API Server [Beta]

A local, built-in HTTP API server for Pear Desktop that exposes endpoints to control the music player, inspect the queue and song information, and receive realtime updates via WebSockets.

> ⚠️ This server is intended for local scripts and integrations. Do not expose it to untrusted networks unless you understand the security implications.

---

## Quick summary

- Base path: `http://{hostname}:{port}` (defaults: `0.0.0.0:26538`)
- OpenAPI / Swagger UI: `http://{hostname}:{port}/swagger`
- API routes: `/api/v1/*` (examples below)
- WebSocket: `GET /api/v1/ws` (upgrades to websocket for realtime player events)
- Authentication: Bearer token (configurable). See **Authentication** below.

---

## Enabling and configuration

1. Open Pear Desktop → Plugins → find **API Server [Beta]** and enable it.
2. Configure options (port, hostname, authorization strategy, TLS, etc.) as needed from the plugin's menu or app settings.
   - `hostname` — interface to bind to. Use `127.0.0.1` to restrict to localhost.
   - `port` — default `26538`.
   - `authStrategy` — `AUTH_AT_FIRST` (default) or `NONE` (no auth).
   - `secret` — internal signing secret for JWT tokens.

---

## Swagger / Documentation

Open the Swagger UI at `/swagger` (e.g. `http://localhost:26538/swagger`) to see the current OpenAPI specification, try endpoints interactively, and inspect request/response schemas.

---

## Authentication

- `AUTH_AT_FIRST` (default): the first time a client requests a token (`POST /auth/{id}`) the app will show a confirmation dialog. If allowed, the server will add the client ID to the plugin's `authorizedClients` list and return a JWT access token. Use the returned token in subsequent requests with `Authorization: Bearer <token>`.
- `NONE`: no authorization checks are performed.

Example token request (client id should be a short unique string):

curl -v -X POST "http://localhost:26538/auth/my-client-id"

Example successful response:

{
  "accessToken": "eyJhbGciOi..."
}

Then call protected endpoints with the Authorization header:

curl -H "Authorization: Bearer eyJhbGci..." "http://localhost:26538/api/v1/song"

Notes:
- The token is a standard JWT signed with the plugin's `secret` config value.
- When using `AUTH_AT_FIRST`, the app will prompt the user on the host machine to accept or deny the request.

---

## Common endpoints & examples

- Get current song information
  - GET `/api/v1/song`

curl -H "Authorization: Bearer <token>" "http://localhost:26538/api/v1/song"

- Get queue information
  - GET `/api/v1/queue`

curl -H "Authorization: Bearer <token>" "http://localhost:26538/api/v1/queue"

- Seek to a time (seconds)
  - POST `/api/v1/seek-to` body: `{ "seconds": 12 }`

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"seconds":12}' "http://localhost:26538/api/v1/seek-to"

- Set volume
  - POST `/api/v1/volume` body: `{ "volume": 50 }` (number expected; plugin passes through the value)

curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"volume":50}' "http://localhost:26538/api/v1/volume"

- Play / Pause / Next / Previous
  - POST `/api/v1/play`, `/api/v1/pause`, `/api/v1/next`, `/api/v1/previous`

curl -X POST -H "Authorization: Bearer <token>" "http://localhost:26538/api/v1/play"

- WebSocket realtime updates (player state, position, volume, etc.)
  - Connect to `ws://{host}:{port}/api/v1/ws`

Example (wscat):

wscat -c ws://localhost:26538/api/v1/ws

You will receive JSON messages with `type` and state payloads (e.g., `PLAYER_INFO`, `PLAYER_STATE_CHANGED`, `POSITION_CHANGED`).

---

## Security recommendations

- Restrict `hostname` to `127.0.0.1` unless you explicitly want other machines to connect.
- Keep `authStrategy` on `AUTH_AT_FIRST` for safer defaults.
- Do not expose the server to the public internet.

---

## Troubleshooting

- If a request returns `403`, ensure you either requested a token successfully or the plugin is configured with `authStrategy: NONE`.
- If endpoints return `204`, it means the server has no data (e.g., no song information available).
- Use the Swagger UI for quick testing of schemas and sample payloads.

---

## Development notes

- The server uses OpenAPI generation with `@hono/zod-openapi` and `@hono/swagger-ui`.
- The auth endpoint is `POST /auth/{id}` and returns `{ accessToken }`.
- See the plugin source for the full list of endpoints and request schemas: `src/plugins/api-server/backend/`.

---

If you'd like, I can add example code snippets for popular languages (Python / Node) or add a short example that shows how to open the WebSocket and handle messages. Let me know which you'd prefer. 👨‍💻
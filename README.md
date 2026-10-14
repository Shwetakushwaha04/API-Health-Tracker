# API Health Tracker

A web app that monitors whether your APIs are up and how fast they respond. Add an API URL, and the server checks it automatically every 30 seconds, stores the results, and shows status, uptime and a response-time chart on a dashboard.

## Features

- **User accounts** with registration, login and JWT authentication (passwords hashed with bcrypt)
- **Per-user API lists**: every user only sees and manages their own APIs
- **Automatic health checks** on a timer, plus a manual **Check** button
- **Tracks** availability, HTTP status code, response time and last-checked time
- **Check history and uptime %** stored in SQLite, so data survives a server restart
- **Response-time chart** (Chart.js) with failed checks marked in red
- **Input validation** and a block on private/internal URLs (see Security)

## Tech stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Backend  | Node.js, Express 5, Axios                    |
| Database | SQLite (better-sqlite3)                      |
| Auth     | JSON Web Tokens, bcryptjs, express-rate-limit |
| Frontend | HTML, CSS, vanilla JavaScript, Chart.js      |
| Tests    | Node's built-in test runner (`node:test`)    |

## Getting started

Requires Node.js 18 or newer.

```bash
git clone https://github.com/Shwetakushwaha04/api-health-tracker.git
cd api-health-tracker
npm install

cp .env.example .env        # on Windows: copy .env.example .env
# open .env and set JWT_SECRET to a long random string

npm start
```

Open http://localhost:3000, register an account and add an API (for example `https://api.github.com/`).

For auto-restart while developing, use `npm run dev`.

## Configuration

Set these in `.env` (see `.env.example`):

| Variable            | Default            | Description                                   |
| ------------------- | ------------------ | --------------------------------------------- |
| `JWT_SECRET`        | (required)         | Secret used to sign login tokens              |
| `PORT`              | `3000`             | Port the server listens on                    |
| `CHECK_INTERVAL_MS` | `30000`            | Time between automatic checks                 |
| `DB_PATH`           | `./data/tracker.db`| Where the SQLite file is stored               |
| `ALLOW_PRIVATE_URLS`| unset              | `true` lets you monitor localhost (dev only)  |

## REST API

All `/api` routes need the header `Authorization: Bearer <token>`.

| Method | Endpoint          | Description                          |
| ------ | ----------------- | ------------------------------------ |
| POST   | `/register`       | Create an account                    |
| POST   | `/login`          | Log in, returns a JWT (valid 1 hour) |
| GET    | `/api`            | List your APIs with status and history |
| POST   | `/api`            | Add an API: `{ "name", "url" }`      |
| POST   | `/api/:id/check`  | Run a health check now               |
| DELETE | `/api/:id`        | Remove an API                        |
| GET    | `/health`         | Server liveness check                |

Example:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"password123"}'
```

## How health is decided

A check counts as **Healthy** if the API answers within 5 seconds with a status code from 200 to 399. Anything else (4xx/5xx, timeout, DNS failure, refused connection) is **Down**. Uptime % is calculated from the last 100 checks.

## Project structure

```
server.js              starts the server and the check scheduler
src/
  app.js               builds the Express app
  db.js                SQLite connection and table setup
  auth.js              password hashing, JWT creation and middleware
  checker.js           health check logic and scheduler
  urlGuard.js          URL validation and private-address blocking
  routes/
    authRoutes.js      /register and /login
    apiRoutes.js       /api CRUD and manual checks
public/                dashboard, login page, CSS, frontend scripts
test/                  automated tests
```

## Security notes

- Passwords are hashed with bcrypt and never stored in plain text.
- Login and registration are rate limited.
- API names and URLs are inserted into the page as plain text, never as HTML, which prevents XSS.
- Because the server makes requests to user-supplied URLs, it rejects non-HTTP(S) URLs, `localhost`, and private or internal IP ranges, and does not follow redirects. This prevents the tool from being used to probe internal networks (SSRF).
- `.env` and the database file are git-ignored.

## Tests

```bash
npm test
```

The tests cover registration and login, token checks, per-user data isolation, URL validation, Healthy/Down detection against a local test server, and database persistence across restarts.

## Possible next steps

- Email or webhook alerts when an API goes down
- Edit an existing API's name or URL
- Configurable check interval per API
- Docker setup for easy deployment

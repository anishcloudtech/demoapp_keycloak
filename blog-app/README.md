# TheBlog — Blog List App

A simple blog application built with **React + TypeScript** (frontend) and **Node.js + Express** (backend), secured by **Keycloak**.

## Port Map

| Service           | URL                      |
|-------------------|--------------------------|
| Keycloak          | http://localhost:8080    |
| Frontend          | http://localhost:3001    |
| Backend API       | http://localhost:4001    |

---

## Keycloak Setup

> Keycloak must be running on `localhost:8080` before you start the app.
> If you already created the `demo` realm for the ecommerce app, skip steps 1–2 below.

### 1. Start Keycloak

From the `keycloak-26.5.6/` folder:

```bash
# Windows
bin\kc.bat start-dev

# Linux / macOS
bin/kc.sh start-dev
```

### 2. Create a Realm (skip if already done)

1. Open http://localhost:8080 and log in as admin.
2. Click **Create Realm**, set **Realm name** to `demo`, click **Create**.

### 3. Create the Client

1. Inside the `demo` realm, go to **Clients → Create client**.
2. Fill in:
   - **Client ID**: `blog-app`
   - **Client Protocol**: `openid-connect`
3. Click **Next**.
4. Toggle **Standard flow** ON, keep others OFF.
5. Click **Next**, then **Save**.
6. Under the **Settings** tab set:
   - **Valid redirect URIs**: `http://localhost:3001/*`
   - **Valid post logout redirect URIs**: `http://localhost:3001`
   - **Web origins**: `http://localhost:3001`
7. Click **Save**.

### 4. Create a Test User (skip if already done)

1. Go to **Users → Add user**, set a username, click **Create**.
2. Go to **Credentials → Set password**, set a password and turn **Temporary** OFF.

---

## Running the App

### Backend

```bash
cd blog-app/backend
npm install
npm run dev        # uses nodemon, restarts on changes
# or: npm start
```

### Frontend

```bash
cd blog-app/frontend
npm install
npm run dev
```

Open http://localhost:3001 — you will see the landing page with a **Login with Keycloak** button.

---

## Project Structure

```
blog-app/
├── frontend/
│   ├── src/
│   │   ├── keycloak.ts          # Keycloak client config
│   │   ├── main.tsx             # Entry point — initialises Keycloak
│   │   ├── App.tsx              # Root component
│   │   ├── index.css
│   │   └── components/
│   │       ├── Dashboard.tsx    # Landing / Login page
│   │       ├── Navbar.tsx       # Top bar with user info
│   │       └── BlogList.tsx     # Protected list of blog posts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── backend/
    ├── src/
    │   ├── index.js             # Express server
    │   ├── middleware/
    │   │   └── auth.js          # JWT verification via Keycloak JWKS
    │   └── routes/
    │       └── posts.js         # Protected blog post endpoints
    ├── .env
    └── package.json
```

## How Auth Works

1. The frontend initialises `keycloak-js` with `check-sso` — the user is not forced to log in immediately.
2. Clicking **Login with Keycloak** redirects to the Keycloak login page.
3. After login, Keycloak redirects back with an **access token** (JWT).
4. Every API request to the backend includes `Authorization: Bearer <token>`.
5. The backend verifies the token against Keycloak's public keys (JWKS endpoint) using `jsonwebtoken` + `jwks-rsa`.

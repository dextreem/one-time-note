# One-Time-Note

One Time Note is a service that allows you to encrypt a note and send it to a friend. Once a note was accessed it is removed immediately and forever. The encryption is performed on the client machine, i.e., the server does not know the un-encrypted note at any point in time. Best part: Since it is open source, you can make sure what I just wrote is true on your own.

Demo on a live instance: https://one-time-note.com

Feel free to grab a copy and deploy wherever you want.

# Implementation Details

This project is built using express.js on node.js. No other major framework is used. The web UI consists of two pages, one to create a note and one to view a note. Both do not use any fancy framework, but only html, javascript, and css. The backend provides two interfaces, one to create a note and one to view a note. It is detached from the web UI so that you can use the backend without the frontend.

Notes are encrypted on client side only for privacy reasons. This means the backend does not check whether the note is actually encrypted or not. If you are not using the web UI you need to make sure your notes are properly encrypted.

Although the notes are encrypted when sent from/to the backend, the whole connection should still be served over HTTPS. Otherwise a MITM could catch the note ID and has access to your still encrypted note. TLS is terminated by a reverse proxy in front of the app, not by the app itself.

One note (pun intended) about the noteID: One could brute force all IDs to retrieve all encrypted notes (or at least delete them). But this would take a lot of time and would leave an attacker with a set of encrypted messages. A limiter (default: 100 requests per 15 minutes per client address) prevents this; it is applied ahead of every route, including the UI and its static assets.

Reading a note is atomic. The read claims the file with a single `rename` before it is served, so if several readers race for the same note exactly one of them gets it and the rest are told, truthfully, that the note is gone.

# How to Start

Requires Node.js 22.12 or newer (see `engines` in `package.json`).

```bash
npm install
npm start        # or: npm run dev  (nodemon)
npm test
```

The port and the storage directory come from `config/default.json`
(`APP_PORT`, `UPLOAD_FOLDER`). `config/test.json` overrides them for the test
suite so tests never touch real notes.

## Docker

```bash
docker build -t one-time-note .

# Notes must live on a volume, or they die with the container.
mkdir -p otn_data && chown 1000:1000 otn_data
docker run -p 127.0.0.1:3000:3000 -v "$PWD/otn_data:/usr/src/app/notes" one-time-note
```

`docker-compose.yml` does the same for local development only; it is never
deployed.

The image runs as the unprivileged `node` user (uid 1000), so **the mounted
directory has to be writable by uid 1000**. A bind mount keeps the host
directory's ownership, hence the `chown` above. A named volume is created
root-owned, so chown it once before first use:

```bash
docker volume create otn-notes
docker run --rm -v otn-notes:/mnt alpine chown 1000:1000 /mnt
```

If the storage directory is not writable the container exits immediately with
an explanatory message rather than starting up and failing every note it is
given.

# Deployment

The container is deliberately boring, so that whatever runs in front of it
stays in charge:

- It serves **plain HTTP on one port** (`EXPOSE 3000`, matching `APP_PORT`).
  There is no TLS and no HTTPS redirect in the app -- the reverse proxy in
  front terminates TLS and redirects. A second redirect inside would loop.
- It binds `0.0.0.0` **inside the container**. Loopback inside a container is
  unreachable from outside it, which would make the published port dead.
- It contains **no domain name and no secrets**, so the same image serves
  one-time-note.com, otn.dobuch.de, or anything else.
- `GET /` returns 200 without touching storage and is the health signal. The
  image declares a `HEALTHCHECK` that uses it.
- `TRUST_PROXY` in `config/default.json` is the number of proxy hops in front
  of the app (1 by default). It has to be right, or the rate limiter sees the
  proxy's address for every request and one client can exhaust the budget for
  everybody. Set it to 0 when nothing is in front, otherwise a client can
  forge `X-Forwarded-For`.

Notes are stored as one file per note under `UPLOAD_FOLDER`, which must be a
mounted volume: it has to survive the container being replaced, or a redeploy
destroys unread notes.

# Support Us?

Feel free to support us by giving this project a star.

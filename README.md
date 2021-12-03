# One-Time-Note

One Time Note is a service that allows you to encrypt a note and send it to a friend. Once a note was accessed it is removed immediately and forever. The encryption is performed on the client machine, i.e., the server does not know the un-encrypted note at any point in time. Best part: Since it is open source, you can make sure what I just wrote is true on your own.

Demo on a live instance: https://one-time-note.com

Feel free to grab a copy and deploy wherever you want.

# Implementation Details

This project is built using express.js on node.js. No other major framework is used. The web UI consists of two pages, one to create a note and one to view a note. Both do not use any fancy framework, but only html, javascript, and css. The backend provides two interfaces, one to create a note and one to view a note. It is detached from the web UI so that you can use the backend without the frontend.

Notes are encrypted on client side only for privacy reasons. This means the backend does not check whether the note is actually encrypted or not. If you are not using the web UI you need to make sure your notes are properly encrypted.

Although the notes are encrypted when sent from/to the backend, it makes sense to use HTTPS to encrypt the whole connection. Otherwise a MITM could catch the note ID and has access to your still encrypted note.

One note (pun intended) about the noteID: One could brute force all IDs to retrieve all encrypted notes (or at least delete them). But this would take a lot of time and would leave an attacker with a set of encrypted messages. A limiter (default: 100 requests per 15 minutes per ID) should prevent this.

# How to Start

```bash
npm install
npm start
```

There is also a dockerfile included. You can build and run it like this:

```bash
docker build -t one-time-note .

docker run one-time-note
# OR
docker compose up
```

# Support Us?

Feel free to support us by giving this project a star.

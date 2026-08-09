# :nerd_face: Erudit game :nerd_face:

This is the backend of Erudite game application.
[Here is the frontend](https://github.com/Ksinia/erudite-client).

## [Check out the deployed version here!](https://erudit.netlify.app)

This is a Russian Scrabble-like game which is made in accordance with the rules of the board version.
[Rules in Russian can be found here.](https://www.mosigra.ru/image/data/mosigra.product.other/399/712/erudit.pdf)

## Details

This project was created using Express.js server and Sequelize ORM.

## installation

- Run `npm install`.
- Connect to a local database (configuration is in the file `/config/config.json`).
- Set SENDGRID_API_KEY environment variable to send email notifications and restore password emails.
- Start the server with `npm run start` for production or `npm run dev` for development.

## Infinite board mode

A game can be created with `boardType: "infinite"` (the default is `"classic"`). An infinite board starts as the usual 15x15 grid and grows by 7 rows or columns on any side where a letter lands within 7 cells of the edge, so a player can always extend a word outward. Growth stops at 99 cells in either direction, since every update carries both boards in full; at that size the far edges behave like the edges of a classic board. The classic bonus pattern tiles the whole plane with a period of 14 cells, sharing the outer triple-word rows between neighbouring tiles; the start star marks only the centre of the original board. When the letter bag cannot refill a full rack anymore, another complete letter set is added to it, so an infinite game never runs out of letters.

The feature is closed by default. The `INFINITE_BOARD_USERS` environment variable lists the user ids allowed to create, see and join infinite games, comma-separated (for example `INFINITE_BOARD_USERS=3,4`). While it is unset or empty nobody has access: infinite games are hidden from the lobby, cannot be opened or joined, and the board type selector stays hidden in the clients.

Access also depends on the client. A client declares what it can handle through the `X-Client-Features` header on requests and through the `features` field of `ADD_USER_TO_SOCKET` on the socket; a build that does not declare `infinite-board` is treated like an account without access, so an older app is never handed a board it cannot draw, and is not notified about such games either. Clients that declare it receive infinite games with the two grids replaced by their occupied cells (`boardSize`, `boardCells`, `previousBoardCells`), because a full grid costs the square of its side on every update. Classic games keep their plain grids for every client.

### Deploying and rolling back

Once any infinite game exists, do not roll the server back to a release older than migration 32. Such games have boards larger than 15x15, older code assumes a 15-wide board when scoring, and the migration's `down` drops `boardOrigin`, the anchor the bonus pattern is read from, which cannot be recovered afterwards.

The order that works when releasing the feature is: deploy the server, which applies migration 32 on boot, then the client, check that classic games still behave on both the old and the new bundle, and only then list the user ids in `INFINITE_BOARD_USERS`.

## Tests

Run `npm test`. The suite covers the board arithmetic in `services/board.ts`: the bonus pattern, board growth and the access list. It needs no database.

## Database migration

To create migration run `npm run db:makemigrations`.

To apply migration rerun the application.

## Local develop with docker-compose

Run

```
docker-compose up -d 
```

to start local postgres14 container. See `docker-compose.yaml` for more details

## Allowed origins

`ORIGIN_URLS` is a comma-separated list of origins that may call the API from a browser. An entry may contain one `*`, standing for a single subdomain label, which covers the branch and preview deployments of one site: `https://*--erudit.netlify.app` admits every branch deploy of that Netlify site without opening the API to the web at large.

## Technologies used

- express
- web sockets

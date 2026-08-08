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

A game can be created with `boardType: "infinite"` (the default is `"classic"`). An infinite board starts as the usual 15x15 grid and grows by 7 rows or columns on any side where a letter lands within 7 cells of the edge, so a player can always extend a word outward. The classic bonus pattern tiles the whole plane with a period of 14 cells, sharing the outer triple-word rows between neighbouring tiles; the start star marks only the centre of the original board. When the letter bag cannot refill a full rack anymore, another complete letter set is added to it, so an infinite game never runs out of letters.

The `INFINITE_BOARD_USERS` environment variable restricts access to the feature: a comma-separated list of user ids that can create, see and join infinite games. When it is unset or empty, the feature is available to everyone.

## Database migration

To create migration run `npm run db:makemigrations`.

To apply migration rerun the application.

## Local develop with docker-compose

Run

```
docker-compose up -d 
```

to start local postgres14 container. See `docker-compose.yaml` for more details

## Technologies used

- express
- web sockets

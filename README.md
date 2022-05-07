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
- Start the server with `npm run start` for production or `npm run dev` for development.

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

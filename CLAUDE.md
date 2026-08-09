# Erudite server

## Migrations

Migration files are loaded by umzug with `require`, and Node decides between
CommonJS and ES modules by looking at the file. A single `import` statement
turns the file into an ES module, where `module.exports` does not exist, and
the app then crashes on startup before serving a request — the migration
runner is on the boot path.

So a migration must stay CommonJS: `const X = require("...")` and
`module.exports = { up, down }`, never `import`. This is also why the
migrations report type errors that the rest of the code does not; the build
script tolerates them on purpose (`tsc || true`).

Before deploying a new migration, load it the way umzug does rather than the
way the test runner does:

```js
const migration = require("./migrations/NN-name.ts");
await migration.up(queryInterface, Sequelize);
```

## Deploying

Production runs on Heroku (`k-erudite`), deployed by pushing to the `heroku`
remote. `heroku releases` is the source of truth for what is actually
running — a release number moving does not mean the app came up.

After any deploy, check that the app answers and that the log is clean:

```
curl -s -o /dev/null -w "%{http_code}\n" https://k-erudite.herokuapp.com/game/10
heroku logs --source app -n 30 -a k-erudite
```

A crashed dyno answers 503 with `code=H10` in the router log; the reason is
only in `--source app`. `heroku rollback` restores the previous release in
seconds and is the right first move while the cause is being found.

## Configuration

Environment variables come from two places, and the order matters:
`dotenv.config()` reads the committed `.env` **without** overriding, so a
Heroku config var of the same name wins. There is no `.env.production` in
the repo. Check with `heroku config -a k-erudite` before assuming which one
is in effect.

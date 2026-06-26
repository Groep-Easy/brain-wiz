# Database

State that must outlive a single connection (rooms, players, rounds, answers, and
the question bank) is persisted in PostgreSQL through TypeORM.

## The decision

PostgreSQL as the store, TypeORM as the access layer, and the schema owned by
**migrations** rather than by TypeORM's auto-`synchronize`.

## Why PostgreSQL and TypeORM

The data is relational: a room has clients, a game has rounds, a round has client
answers, and answers reference questions. A relational database models that
directly, and TypeORM gives typed entities plus a migration tool that fits the
existing NestJS and TypeScript stack.

## Why migrations and not synchronize

`synchronize: true` makes TypeORM reshape the schema to match the entities on
every boot. That is convenient in development but unsafe in production, where it
can drop a column or a table on a model change. Instead the server runs a squashed
baseline migration (`InitialSchema…`) with `migrationsRun` enabled on startup, and
production forbids `DB_SYNCHRONIZE` outright. This is what lets a fresh production
database come up with the correct schema instead of failing with "relation does
not exist".

## What is and is not persisted

Persisted: the entities under `src/server/entities` (Room, Client, Round,
ClientAnswer, Question, GameBlock, and the puzzle and coding-challenge content
types). Live per-connection state (which socket is which player right now) is kept
in memory and rebuilt on reconnect; only what must survive a restart goes to the
database. The question bank is seeded on boot from `assets/test-data`.

## Where it lives

`src/server/entities` (the model), `src/server/database` (the data source,
migrations, and the boot-time question seeder), and
`src/config/database.config.ts` (validated connection settings, including the
production guards).

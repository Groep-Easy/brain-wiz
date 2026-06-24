# Random Question Selection

Every round of the game needs a random question that hasn't been used yet. The
first version of this did more work than it needed to, so we tightened it up as
part of the green thinking criteria.

## What it used to do

The service asked the database for **all** unused questions, pulled the whole
list into the server's memory, and then picked one at random in JavaScript:

```ts
const unusedQuestions = await queryBuilder.getMany()
const randomIndex = Math.floor(Math.random() * unusedQuestions.length)
return unusedQuestions[randomIndex] ?? null
```

That works fine with a handful of questions, but it scales badly. The more
questions the bank holds, the more rows get transferred from the database to the
server and held in memory on every single round, even though we only ever keep
one of them.

## What we changed

We now let the database do the picking and hand back just the one row we want:

```ts
const question = await queryBuilder.orderBy('RANDOM()').limit(1).getOne()
return question ?? null
```

The `usedIds` filter still runs the same way, so we never repeat a question
within a game. The only difference is that the random choice happens in the
query (`ORDER BY RANDOM() LIMIT 1`) instead of in Node.

## Why this supports green thinking

It does less work for the same result. Each round now transfers a single row
instead of the whole unused-question set, and the server no longer allocates and
throws away a full list every time it needs one question. That means less data
over the database connection, less memory churn and garbage collection on the
server, and the cost stays flat as the question bank grows instead of creeping
up with it.

The behaviour for players is identical: they still get a random question that
hasn't come up yet.

## Where it lives

`src/server/question/question.service.ts`, in `getRandomQuestion`.

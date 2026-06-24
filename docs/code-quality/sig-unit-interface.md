# SIG Unit Interface: Parameter-Count Observations

**Author:** Mees Rootjes (mees.rootjes@student.uva.nl)

While working through SIG's "unit interface" findings (the metric that flags a
unit for having too many parameters), we noticed that a number of the findings
report more parameters than the source code actually declares. Most findings are
accurate and point at real, long parameter lists. But a specific subset is
inflated, and the inflation follows two clear patterns that both look like the
analyzer parsing something that isn't a parameter.

This note documents what we observed, with worked examples, so it can be checked
independently.

## Pattern 1: NestJS dependency-injection constructors

NestJS builds its services by injecting their dependencies through the
constructor. For repositories, the injection is expressed with a decorator,
`@InjectRepository(...)`. We observed that SIG seems to count that decorator as
its own extra parameter (reported as `any`), so each injected repository is
counted roughly twice.

### Worked example: `RoundBuilder`

**What SIG reports** (from the exported findings):

> 9 parameters for unit
> `RoundBuilder.constructor(any, Repository<Question>, any, Repository<Round>, any, Repository<Room>, any, Repository<GameBlock>, MinigameRegistry)`
> Severity HIGH, `src/server/room/game/round-builder.ts#L51:57`, parameters: 9

**What the source actually declares** (`src/server/room/game/round-builder.ts`,
lines 51-57):

```ts
public constructor(
  @InjectRepository(Question) private readonly questions: Repository<Question>,
  @InjectRepository(Round) private readonly rounds: Repository<Round>,
  @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
  @InjectRepository(GameBlock) private readonly blocks: Repository<GameBlock>,
  private readonly minigames: MinigameRegistry
) {}
```

That is **5 parameters**: four repositories and one registry.

**Lining the two up** shows exactly where the difference comes from. SIG's
reported signature is:

```
(any, Repository<Question>, any, Repository<Round>, any, Repository<Room>, any, Repository<GameBlock>, MinigameRegistry)
  ^^^                        ^^^                     ^^^                    ^^^
  phantom                    phantom                 phantom                phantom
```

Each `@InjectRepository(X)` becomes the pair `any, Repository<X>` in the count.
Four decorators add four phantom `any` entries, turning 5 real parameters into 9
reported ones. The plain `MinigameRegistry` dependency, which has no decorator,
is counted once, as expected.

### The same pattern across the codebase

Every constructor that injects repositories (or uses `@Inject(token)` for an
interface dependency) shows the same gap:

| Constructor         | SIG reports | Actual parameters             |
| ------------------- | ----------- | ----------------------------- |
| `RoundBuilder`      | 9           | 5 (4 repositories + registry) |
| `GameEngineService` | 9           | 7                             |
| `SocketGateway`     | 8           | 6                             |
| `AnswerService`     | 6           | 5                             |
| `ScoringService`    | 6           | 5                             |

One constructor is **not** affected: `LobbyService` is reported as 7 and really
does take 7 parameters, because all of its dependencies are plain services with
no injection decorator. So the metric is accurate when no decorators are
involved, which is consistent with the reading above.

## Pattern 2: functions with a defaulted parameter

The second pattern is smaller but just as clear. A parameter that has a default
value seems to be miscounted as two extra `any` parameters.

### Worked example: `createRoundSubmitPayload`

**What SIG reports:**

> 5 parameters for unit
> `roundPayload.ts.createRoundSubmitPayload(RoundContentPayload, unknown, any, any, any)`
> `src/minigames/roundPayload.ts#L11:22`, parameters: 5

**What the source actually declares** (`src/minigames/roundPayload.ts`):

```ts
export function createRoundSubmitPayload(
  content: RoundContentPayload,
  submission: unknown,
  timestamp = Date.now()
): RoundSubmitPayload {
  ...
}
```

That is **3 parameters**. The first two (`content`, `submission`) are counted
correctly, but the single defaulted parameter `timestamp = Date.now()` is
reported as the three trailing entries `any, any, any`. The sibling function
`createRoundChoiceSubmitPayload`, which also ends in `timestamp = Date.now()`,
shows the identical 3-becomes-5 jump.

## Summary

On this codebase, the unit-interface metric is reliable for ordinary functions,
but it over-reports parameters in two specific situations:

1. **NestJS DI constructors**, where each `@InjectRepository` / `@Inject`
   decorator adds a phantom `any` parameter.
2. **Defaulted parameters**, where a `param = value` initializer is counted as
   extra `any` parameters.

In both cases the reported number is higher than the real signature, so the
HIGH/MEDIUM severity on those particular findings reflects the parser rather than
the code. We are raising this because several of our highest-severity
unit-interface findings fall entirely into these two categories.

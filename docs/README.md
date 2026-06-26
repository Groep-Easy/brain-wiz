# Documentation

How Brain Wiz is built, run, and kept healthy. New here? Start with
[Getting started](onboarding/getting-started.md), then the
[architecture overview](architecture/overview.md).

## Architecture

How the system fits together and the decisions behind it.

- [Overview](architecture/overview.md): the big picture and the authoritative-server decision.
- [WebSocket layer](architecture/websockets.md): why live gameplay runs over native `ws`.
- [HTTP API](architecture/http-api.md): why content management is a separate REST channel.
- [Database](architecture/database.md): why PostgreSQL and TypeORM, managed by migrations.
- [Nginx proxy](architecture/nginx-proxy.md): the production edge (TLS, isolation, logging).

## Onboarding

- [Getting started](onboarding/getting-started.md): setup, run, and daily commands.
- [Git workflow](onboarding/git-workflow.md): branches, commits, and PRs.

## Game design

- [Round types](game-design/round-types.md): the round families and the minigame contract.
- [Sliding Puzzle](game-design/sliding-puzzle.md): server state, board flow, and scoring notes.
- [Balance Scale](game-design/balance-scale.md): public/private state, answer flow, and scoring notes.
- [Vault Rush](game-design/vault-rush.md): a worked minigame in depth.

## Security

- [Rate limiting](security/rate-limiting.md)
- [Reverse proxy](security/reverse-proxy.md)
- [Input validation](security/validation.md)
- [WebSocket hardening](security/websocket-hardening.md)

## Code quality

- [Overview](code-quality/overview.md): the SIG-driven maintainability work.
- [SIG unit interface observations](code-quality/sig-unit-interface.md): where the metric over-reports.

## Green thinking

- [Random question selection](green-thinking/random-question-selection.md)
- [Timer socket traffic](green-thinking/timer-socket-traffic.md)

## Pipelines

- [CI pipeline](pipelines/ci-pipeline.md)
- [Sigrid pipeline](pipelines/sigrid-pipeline.md)

## Reference

Protocol and flow references that do not belong to one section.

- [REST API](other/rest-api.md)
- [WebSocket protocol](other/socket-protocol.md)
- [QR code flow](other/qrcode-flow.md)

## Also

- [Plagiarism statement](PLAGIARISM.md)

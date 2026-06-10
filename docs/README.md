# Brain Wiz documentation

The full documentation set for Brain Wiz. Start with **Getting started** to run
the project, then **Architecture** for how it all fits together.

## Onboarding

| Doc                                              | What it covers                                   |
| ------------------------------------------------ | ------------------------------------------------ |
| [Getting started](onboarding/GETTING_STARTED.md) | Prerequisites, setup, daily commands, team rules |

## Architecture

| Doc                                          | What it covers                                                 |
| -------------------------------------------- | -------------------------------------------------------------- |
| [Architecture overview](ARCHITECTURE.md)     | Runtime contexts, module structure, security, build & run      |
| [Game flow & scoring](gameplay/GAME_FLOW.md) | The round engine loop, phases, event bus, scoring, leaderboard |
| [Data model](data-model/DATA_MODEL.md)       | Entities, fields, constraints, enums, migrations               |

## API & protocols

| Doc                                          | What it covers                                       |
| -------------------------------------------- | ---------------------------------------------------- |
| [WebSocket protocol](api/SOCKET_PROTOCOL.md) | Event names, payloads, and the room/game wire format |
| [REST API](api/REST_API.md)                  | HTTP endpoints for content management (questions)    |
| [QR-code flow](api/QRCODE_FLOW.md)           | How room join codes and QR codes are generated       |

## Game design

| Doc                                       | What it covers               |
| ----------------------------------------- | ---------------------------- |
| [Round types](game-design/ROUND_TYPES.md) | Game round / minigame design |

---

For a high-level project summary and quick start, see the
[repository README](../README.md).

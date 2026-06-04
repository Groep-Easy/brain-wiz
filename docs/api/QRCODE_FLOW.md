# QR Code Generation

This feature allows a host to create a game room and immediately receive the join information players need. The server generates a unique room code, builds a join URL, converts that URL into an SVG QR code, and stores everything as part of the room record.

---

## Overview

The QR-code flow is part of the room lifecycle. When a room is created, the backend prepares both join options:

- a **manual join code** for players who type the code themselves;
- a **QR code** for players who scan the host screen with their phone.

```text
Host creates room
        ↓
RoomService generates unique join code
        ↓
RoomService builds join URL
        ↓
QrcodeService converts URL to SVG
        ↓
Room is saved in PostgreSQL
        ↓
Host display can show code + QR code
```

---

## Core files

| File                                | Purpose                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `qrcode/qrcode.service.ts`          | Generates the QR code as an SVG string.                                       |
| `qrcode/qrcode.module.ts`           | Registers and exports the QR-code service.                                    |
| `room/room.service.ts`              | Creates rooms, generates join codes, builds QR payloads, and saves room data. |
| `room/room.module.ts`               | Wires the room feature together with database and QR-code support.            |
| `room/room.controller.ts`           | Exposes the HTTP endpoints for creating and retrieving rooms.                 |
| `entities/room.entity.ts`           | Defines how room and QR-code data is stored in PostgreSQL.                    |
| `database/migrations/add-qrcode.ts` | Adds the QR-code columns to the `rooms` table.                                |

---

## QR-code service

`QrcodeService` is a small wrapper around the `qrcode` library. It keeps QR-code generation isolated from the rest of the application.

```ts
@Injectable()
export class QrcodeService {
  public async generateSvg(text: string): Promise<string> {
    return QRCode.toString(text, {
      type: 'svg',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }
}
```

The service receives plain text and returns an SVG string. In this project, the text is the join URL for a room.

Example payload:

```text
http://localhost:3000/join?code=ABCD1234
```

The result is stored as text, not as a separate image file. This makes the QR code easy to save in the database and easy to render on the host display.

---

## Module setup

The QR-code service is registered inside its own NestJS module.

```ts
@Module({
  providers: [QrcodeService],
  exports: [QrcodeService],
})
export class QrcodeModule {}
```

Because the service is exported, other modules can use it through NestJS dependency injection.

`RoomModule` imports `QrcodeModule`, so `RoomService` can inject `QrcodeService` when creating a room.

```ts
@Module({
  imports: [DatabaseModule, QrcodeModule],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
```

This keeps the room logic clean. `RoomService` decides **when** a QR code is needed, while `QrcodeService` decides **how** the QR code is generated.

---

## Room creation flow

The main logic happens inside `RoomService`.

When a host creates a room, the service:

1. generates a unique join code;
2. builds the join URL;
3. generates the QR-code SVG;
4. creates a new room entity;
5. saves the room in PostgreSQL.

```ts
const joinCode = await this.generateUniqueJoinCode()
const qrCodePayload = `${config.BASE_URL}/join?code=${joinCode}`
const qrCodeSvg = await this.qrcodeService.generateSvg(qrCodePayload)
```

The room is then saved with the generated QR-code values:

```ts
const room = this.rooms.create({
  joinCode,
  qrCodePayload,
  qrCodeSvg,
  status: RoomStatusEnum.LOBBY,
})

return this.rooms.save(room)
```

This means the host does not need to generate the QR code manually. The server prepares the complete join information as soon as the room is created.

---

## Unique join codes

A room code must be unique while a room is still usable. The backend checks for existing rooms with the same code before saving a new one.

```ts
private async generateUniqueJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const existing = await this.rooms.findOne({
      where: {
        joinCode: code,
        status: In([RoomStatusEnum.LOBBY, RoomStatusEnum.ACTIVE]),
      },
    })

    if (!existing) {
      return code
    }
  }

  throw new Error('Unable to generate a unique room code')
}
```

Only `LOBBY` and `ACTIVE` rooms are checked. Finished or abandoned rooms do not block a code forever.

---

## Database model

The `Room` entity stores the join code, QR-code payload, and generated SVG.

```ts
@Column('varchar', { length: 16 })
public joinCode!: string

@Column('varchar', { length: 512 })
public qrCodePayload!: string

@Column('text')
public qrCodeSvg!: string
```

| Field           | Description                                  |
| --------------- | -------------------------------------------- |
| `joinCode`      | Short code shown on the host screen.         |
| `qrCodePayload` | Full URL that is encoded inside the QR code. |
| `qrCodeSvg`     | Generated SVG markup for the QR code.        |

The entity also uses a partial index for active room codes:

```ts
@Index('idx_rooms_join_code_active', ['joinCode'], {
  where: "(status IN ('lobby', 'active'))",
})
```

This supports fast lookups and prevents active room-code conflicts.

---

## Database migration

The QR-code fields are added through a TypeORM migration.

```ts
await queryRunner.addColumns('rooms', [
  new TableColumn({
    name: 'qrCodePayload',
    type: 'varchar',
    length: '512',
    isNullable: false,
    default: "''",
  }),
  new TableColumn({
    name: 'qrCodeSvg',
    type: 'text',
    isNullable: false,
    default: "''",
  }),
])
```

The migration uses temporary defaults so existing rows can be updated safely. After the columns are added, the defaults are removed so new room records must provide real QR-code values.

---

## API response

The room controller can return the data needed by the host display.

```ts
return {
  code: room.joinCode,
  qrCodePayload: room.qrCodePayload,
  qrCodeSvg: room.qrCodeSvg,
  status: room.status,
}
```

Example response:

```json
{
  "code": "ABCD1234",
  "qrCodePayload": "http://localhost:3000/join?code=ABCD1234",
  "qrCodeSvg": "<svg>...</svg>",
  "status": "lobby"
}
```

The host display can use this response to show both the manual join code and the QR code.

---

## Rendering the SVG

Because the QR code is returned as SVG markup, it can be rendered directly by the frontend.

Plain HTML example:

```ts
const qrContainer = document.getElementById('qr-code')
qrContainer.innerHTML = room.qrCodeSvg
```

React example:

```tsx
<div dangerouslySetInnerHTML={{ __html: room.qrCodeSvg }} />
```

Only render SVG that comes from the trusted backend. Do not render random user input as HTML.

---

## Host token separation

The QR code is meant for players. It should only contain the public join URL.

```text
/join?code=ABCD1234
```

Host-only values, such as a `hostToken`, should not be placed inside the QR code. This keeps player access and host control separate.

---

## Relation to lobby and sockets

QR-code generation itself is handled through HTTP room creation and database persistence. It does not require WebSockets.

The lobby and socket elements become relevant after players start joining:

| Element                              | Role                                                      |
| ------------------------------------ | --------------------------------------------------------- |
| `ConnectionRegistry`                 | Keeps track of active WebSocket connections in memory.    |
| `RoomBroadcaster`                    | Sends lobby updates to connected host and player sockets. |
| `room.helpers.ts`                    | Maps database entities to shared room-state objects.      |
| `room.errors.ts` / `lobby.errors.ts` | Defines domain-specific errors for room and lobby flows.  |

In short:

```text
QR-code generation = room creation + database + QrcodeService
Live lobby updates = sockets + connection registry + broadcaster
```

---

## Final result

The backend now prepares all join information when a room is created:

- a unique room code;
- a join URL;
- an SVG QR code;
- a persisted room record in PostgreSQL.

This gives the host display everything it needs to show a clean join screen for players.

```text
Join code: ABCD1234
Scan QR code: /join?code=ABCD1234
```

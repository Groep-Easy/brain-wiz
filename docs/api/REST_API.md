# Brain Wiz REST API

This document describes the HTTP REST endpoints available for managing Brain Wiz server entities.
Currently, real-time gameplay occurs over WebSockets, but content management (such as questions) is handled via a secure REST API.

---

## Global Authentication

All secure REST API endpoints require a static API key to be passed in the headers. This prevents unauthorized clients from altering the content pool.

**Header Required:**

```http
x-api-key: <ADMIN_API_KEY>
```

> [!NOTE]
> For local development, if `ADMIN_API_KEY` is not provided in the `.env` file, the server will default to accepting `dev-secret-key`. In a production environment, failing to set `ADMIN_API_KEY` will cause the server crash on startup for safety.

If a request is sent without a valid key, the server responds with:

- **`401 Unauthorized`**

---

## Endpoints

### 1. Create a Question

Adds a new trivia question to the global database pool.

- **URL:** `/questions`
- **Method:** `POST`
- **Auth required:** Yes (`x-api-key` header)

#### Request Payload (JSON)

The payload strictly enforces data integrity. The constraints listed below are handled seamlessly by NestJS `class-validator` Data Transfer Objects (DTOs).

| Field              | Type       | Required | Constraints                                                 | Description                            |
| :----------------- | :--------- | :------: | :---------------------------------------------------------- | :------------------------------------- |
| `text`             | `string`   | **Yes**  | Max 512 chars                                               | The text body of the question          |
| `theme`            | `enum`     | **Yes**  | `general`, `science`, `history`, `pop_culture`, `geography` | The thematic category                  |
| `difficulty`       | `enum`     | **Yes**  | `easy`, `medium`, `hard`                                    | Used for point scaling & filtering     |
| `correctAnswers`   | `string[]` | **Yes**  | 1-2 items, non-empty, Max 512 chars each                    | The list of acceptable correct answers |
| `wrongAnswers`     | `string[]` |    No    | 0-1 item, non-empty, Max 512 chars each                     | The list of incorrect distractors      |
| `imagePath`        | `string`   |    No    | Max 512 chars                                               | URL or relative path to a visual clue  |
| `timeLimitSeconds` | `number`   |    No    | Min: 1, Max: 32767                                          | Explicit round time limit (seconds)    |
| `basePoints`       | `number`   |    No    | Min: 0, Max: 32767, Default: 1000                           | Points awarded before time scaling     |

> [!IMPORTANT]
> **Total Answers Constraint**
> The system requires that the **exact sum of options** between `correctAnswers` and `wrongAnswers` equals exactly **2**. You can provide either:
>
> 1. `1` correct answer + `1` wrong answer
> 2. `2` correct answers + `0` wrong answers
>
> Sending any other combination will result in a `400 Bad Request`.

#### Example Request

```http
POST /questions HTTP/1.1
Host: localhost:3000
Content-Type: application/json
x-api-key: dev-secret-key

{
  "text": "What is the powerhouse of the cell?",
  "theme": "science",
  "difficulty": "easy",
  "correctAnswers": ["Mitochondria"],
  "wrongAnswers": ["Nucleus"],
  "basePoints": 1000
}
```

#### Responses

**Success (201 Created)**
The question was successfully validated and persisted to the database.

```json
{
  "id": "e6a12b48-3333-4f15-8c73-456d9821a71c"
}
```

**Validation Error (400 Bad Request)**
The payload violated the DTO structural rules or the total answers constraint.

```json
{
  "message": ["Question must have exactly 2 possible answers"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**Database Error (500 Internal Server Error)**
An unexpected issue occurred while saving to Postgres.

```json
{
  "message": "Failed to save question to database",
  "error": "Internal Server Error",
  "statusCode": 500
}
```

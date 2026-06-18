import { MigrationInterface, QueryRunner } from 'typeorm'

export class InitialSchema1750000000000 implements MigrationInterface {
  public name = 'InitialSchema1750000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
    await queryRunner.query(
      `CREATE TYPE "public"."questions_theme_enum" AS ENUM('history', 'science', 'sport', 'culture', 'geography', 'technology', 'art', 'other', 'coding', 'films', 'gaming', 'general', 'internet', 'music')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."questions_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`
    )
    await queryRunner.query(
      `CREATE TABLE "questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "text" character varying(512) NOT NULL, "theme" "public"."questions_theme_enum" NOT NULL, "difficulty" "public"."questions_difficulty_enum" NOT NULL, "correctAnswers" text array NOT NULL DEFAULT '{}', "wrongAnswers" text array NOT NULL DEFAULT '{}', "imagePath" character varying(512) NOT NULL, "timeLimitSeconds" smallint, "basePoints" smallint NOT NULL DEFAULT '1000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE INDEX "idx_questions_theme_difficulty" ON "questions"  ("theme", "difficulty")`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."coding_challenges_language_enum" AS ENUM('java', 'python', 'javascript', 'typescript', 'cpp', 'csharp', 'rust', 'go', 'other')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."coding_challenges_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`
    )
    await queryRunner.query(
      `CREATE TABLE "coding_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(512) NOT NULL, "prompt" text NOT NULL, "codeSnippet" text, "language" "public"."coding_challenges_language_enum" NOT NULL, "difficulty" "public"."coding_challenges_difficulty_enum" NOT NULL, "correctAnswer" character varying(256) NOT NULL, "wrongAnswers" text array NOT NULL, "solutionExplanation" text, "imagePath" character varying(512) NOT NULL, "timeLimitSeconds" smallint, "basePoints" smallint NOT NULL DEFAULT '1000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0eeba4124d8599cb3265a491af" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE INDEX "idx_coding_language_difficulty" ON "coding_challenges"  ("language", "difficulty")`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."puzzles_difficulty_enum" AS ENUM('easy', 'medium', 'hard')`
    )
    await queryRunner.query(
      `CREATE TABLE "puzzles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(256) NOT NULL, "description" text NOT NULL, "puzzleType" character varying(64) NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "difficulty" "public"."puzzles_difficulty_enum" NOT NULL, "imagePath" character varying(512) NOT NULL, "timeLimitSeconds" smallint, "maxPoints" smallint NOT NULL DEFAULT '1000', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_edb2bdf7671741f1efb202fc090" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(`CREATE INDEX "idx_puzzles_type" ON "puzzles"  ("puzzleType")`)
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_status_enum" AS ENUM('lobby', 'active', 'finished', 'abandoned')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_selectedgamemodes_enum" AS ENUM('questions', 'coding', 'puzzles')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_selectedthemes_enum" AS ENUM('history', 'science', 'sport', 'culture', 'geography', 'technology', 'art', 'other', 'coding', 'films', 'gaming', 'general', 'internet', 'music')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."rooms_selectedlanguages_enum" AS ENUM('java', 'python', 'javascript', 'typescript', 'cpp', 'csharp', 'rust', 'go', 'other')`
    )
    await queryRunner.query(
      `CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "joinCode" character varying(16) NOT NULL, "qrCodePayload" character varying(512) NOT NULL DEFAULT '', "qrCodeSvg" text NOT NULL DEFAULT '', "usedQuestionsIds" uuid array NOT NULL DEFAULT ARRAY[]::uuid[], "status" "public"."rooms_status_enum" NOT NULL DEFAULT 'lobby', "hostSocketId" character varying(128), "selectedGameModes" "public"."rooms_selectedgamemodes_enum" array NOT NULL, "selectedThemes" "public"."rooms_selectedthemes_enum" array NOT NULL, "selectedLanguages" "public"."rooms_selectedlanguages_enum" array NOT NULL, "gameFlow" jsonb NOT NULL DEFAULT '[]'::jsonb, "totalRounds" smallint NOT NULL DEFAULT '10', "defaultTimeLimitSeconds" smallint NOT NULL DEFAULT '20', "currentRoundIndex" smallint NOT NULL DEFAULT '0', "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE INDEX "idx_rooms_join_code_active" ON "rooms"  ("joinCode") WHERE (status IN ('lobby', 'active'))`
    )
    await queryRunner.query(
      `CREATE TABLE "clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" uuid NOT NULL, "displayName" character varying(64) NOT NULL, "playerAvatar" jsonb, "socketId" character varying(128), "isConnected" boolean NOT NULL DEFAULT false, "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "totalScore" integer NOT NULL DEFAULT '0', "finalRank" smallint, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(`CREATE INDEX "idx_clients_room" ON "clients"  ("roomId")`)
    await queryRunner.query(
      `CREATE TYPE "public"."rounds_status_enum" AS ENUM('pending', 'active', 'scoring', 'finished')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."rounds_contenttype_enum" AS ENUM('question', 'coding_challenge', 'puzzle')`
    )
    await queryRunner.query(
      `CREATE TABLE "rounds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" uuid NOT NULL, "roundIndex" smallint NOT NULL, "status" "public"."rounds_status_enum" NOT NULL DEFAULT 'pending', "contentType" "public"."rounds_contenttype_enum" NOT NULL, "gameType" character varying(64) NOT NULL DEFAULT 'quiz', "seed" character varying(128), "publicState" jsonb, "privateState" jsonb, "scoringConfig" jsonb, "timeLimitSeconds" smallint NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "questionId" uuid, "codingChallengeId" uuid, "puzzleId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9d254884a20817016e2f877c7e7" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_rounds_no_repeat_puzzle" ON "rounds"  ("roomId", "puzzleId") WHERE "puzzleId" IS NOT NULL`
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_rounds_no_repeat_coding" ON "rounds"  ("roomId", "codingChallengeId") WHERE "codingChallengeId" IS NOT NULL`
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_rounds_no_repeat_question" ON "rounds"  ("roomId", "questionId") WHERE "questionId" IS NOT NULL`
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_rounds_index_unique_per_room" ON "rounds"  ("roomId", "roundIndex")`
    )
    await queryRunner.query(
      `CREATE TABLE "client_answers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientId" uuid NOT NULL, "roundId" uuid NOT NULL, "answerValue" text NOT NULL, "isCorrect" boolean, "pointsAwarded" integer, "answeredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "timeToAnswerMs" integer, "isTimeout" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6e68d552b046b6178540992f61f" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_client_answers_unique_submission" ON "client_answers"  ("clientId", "roundId")`
    )
    await queryRunner.query(
      `CREATE INDEX "idx_client_answers_answered" ON "client_answers"  ("answeredAt")`
    )
    await queryRunner.query(
      `CREATE INDEX "idx_client_answers_round" ON "client_answers"  ("roundId")`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."game_blocks_kind_enum" AS ENUM('theme', 'minigame')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."game_blocks_theme_enum" AS ENUM('history', 'science', 'sport', 'culture', 'geography', 'technology', 'art', 'other', 'coding', 'films', 'gaming', 'general', 'internet', 'music')`
    )
    await queryRunner.query(
      `CREATE TABLE "game_blocks" ("id" character varying(64) NOT NULL, "kind" "public"."game_blocks_kind_enum" NOT NULL, "label" character varying(64) NOT NULL, "icon" character varying(16) NOT NULL DEFAULT '', "theme" "public"."game_blocks_theme_enum", "minigameKey" character varying(64), "sortOrder" smallint NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b9a64ce34435d097a40868f76b0" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `ALTER TABLE "clients" ADD CONSTRAINT "FK_a5a25ce67fc852805e4b0666c06" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "rounds" ADD CONSTRAINT "FK_9b407dfc14e404078fef418807f" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "rounds" ADD CONSTRAINT "FK_880cb744f620387c8f900926860" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "rounds" ADD CONSTRAINT "FK_faf03543b89d968b6632c69e74e" FOREIGN KEY ("codingChallengeId") REFERENCES "coding_challenges"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "rounds" ADD CONSTRAINT "FK_75996c2fafd2473a1a2231a28e1" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "client_answers" ADD CONSTRAINT "FK_a527edd67acc6b12bc7b73dabda" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "client_answers" ADD CONSTRAINT "FK_cd75190a643eaee40c818746433" FOREIGN KEY ("roundId") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `CREATE TABLE "query-result-cache" ("id" SERIAL NOT NULL, "identifier" character varying, "time" bigint NOT NULL, "duration" integer NOT NULL, "query" text NOT NULL, "result" text NOT NULL, CONSTRAINT "PK_6a98f758d8bfd010e7e10ffd3d3" PRIMARY KEY ("id"))`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "public"."questions_theme_enum"`)
    await queryRunner.query(`DROP TYPE "public"."questions_difficulty_enum"`)
    await queryRunner.query(`DROP TABLE "questions"`)
    await queryRunner.query(`DROP INDEX "public"."idx_questions_theme_difficulty"`)
    await queryRunner.query(`DROP TYPE "public"."coding_challenges_language_enum"`)
    await queryRunner.query(`DROP TYPE "public"."coding_challenges_difficulty_enum"`)
    await queryRunner.query(`DROP TABLE "coding_challenges"`)
    await queryRunner.query(`DROP INDEX "public"."idx_coding_language_difficulty"`)
    await queryRunner.query(`DROP TYPE "public"."puzzles_difficulty_enum"`)
    await queryRunner.query(`DROP TABLE "puzzles"`)
    await queryRunner.query(`DROP INDEX "public"."idx_puzzles_type"`)
    await queryRunner.query(`DROP TYPE "public"."rooms_status_enum"`)
    await queryRunner.query(`DROP TYPE "public"."rooms_selectedgamemodes_enum"`)
    await queryRunner.query(`DROP TYPE "public"."rooms_selectedthemes_enum"`)
    await queryRunner.query(`DROP TYPE "public"."rooms_selectedlanguages_enum"`)
    await queryRunner.query(`DROP TABLE "rooms"`)
    await queryRunner.query(`DROP INDEX "public"."idx_rooms_join_code_active"`)
    await queryRunner.query(`DROP TABLE "clients"`)
    await queryRunner.query(`DROP INDEX "public"."idx_clients_room"`)
    await queryRunner.query(`DROP TYPE "public"."rounds_status_enum"`)
    await queryRunner.query(`DROP TYPE "public"."rounds_contenttype_enum"`)
    await queryRunner.query(`DROP TABLE "rounds"`)
    await queryRunner.query(`DROP INDEX "public"."idx_rounds_no_repeat_puzzle"`)
    await queryRunner.query(`DROP INDEX "public"."idx_rounds_no_repeat_coding"`)
    await queryRunner.query(`DROP INDEX "public"."idx_rounds_no_repeat_question"`)
    await queryRunner.query(`DROP INDEX "public"."idx_rounds_index_unique_per_room"`)
    await queryRunner.query(`DROP TABLE "client_answers"`)
    await queryRunner.query(`DROP INDEX "public"."idx_client_answers_unique_submission"`)
    await queryRunner.query(`DROP INDEX "public"."idx_client_answers_answered"`)
    await queryRunner.query(`DROP INDEX "public"."idx_client_answers_round"`)
    await queryRunner.query(`DROP TYPE "public"."game_blocks_kind_enum"`)
    await queryRunner.query(`DROP TYPE "public"."game_blocks_theme_enum"`)
    await queryRunner.query(`DROP TABLE "game_blocks"`)
    await queryRunner.query(
      `ALTER TABLE "clients" DROP CONSTRAINT "FK_a5a25ce67fc852805e4b0666c06"`
    )
    await queryRunner.query(`ALTER TABLE "rounds" DROP CONSTRAINT "FK_9b407dfc14e404078fef418807f"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP CONSTRAINT "FK_880cb744f620387c8f900926860"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP CONSTRAINT "FK_faf03543b89d968b6632c69e74e"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP CONSTRAINT "FK_75996c2fafd2473a1a2231a28e1"`)
    await queryRunner.query(
      `ALTER TABLE "client_answers" DROP CONSTRAINT "FK_a527edd67acc6b12bc7b73dabda"`
    )
    await queryRunner.query(
      `ALTER TABLE "client_answers" DROP CONSTRAINT "FK_cd75190a643eaee40c818746433"`
    )
    await queryRunner.query(`DROP TABLE "query-result-cache"`)
  }
}

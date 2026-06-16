import { MigrationInterface, QueryRunner } from 'typeorm'

export class CreateGameBlocks implements MigrationInterface {
  public name = 'CreateGameBlocks'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."game_blocks_kind_enum" AS ENUM('theme', 'minigame')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."game_blocks_theme_enum" AS ENUM('history', 'science', 'sport', 'culture', 'geography', 'technology', 'art', 'other')`
    )
    await queryRunner.query(
      `CREATE TABLE "game_blocks" (
        "id" character varying(64) NOT NULL,
        "kind" "public"."game_blocks_kind_enum" NOT NULL,
        "label" character varying(64) NOT NULL,
        "icon" character varying(16) NOT NULL DEFAULT '',
        "theme" "public"."game_blocks_theme_enum",
        "minigameKey" character varying(64),
        "sortOrder" smallint NOT NULL DEFAULT '0',
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_blocks_kind_payload" CHECK (
          (
            "kind" = 'theme'
            AND "theme" IS NOT NULL
            AND "minigameKey" IS NULL
          )
          OR (
            "kind" = 'minigame'
            AND "theme" IS NULL
            AND "minigameKey" IS NOT NULL
          )
        ),
        CONSTRAINT "PK_game_blocks_id" PRIMARY KEY ("id")
      )`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "game_blocks"`)
    await queryRunner.query(`DROP TYPE "public"."game_blocks_theme_enum"`)
    await queryRunner.query(`DROP TYPE "public"."game_blocks_kind_enum"`)
  }
}

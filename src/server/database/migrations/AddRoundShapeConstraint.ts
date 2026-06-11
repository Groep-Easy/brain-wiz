import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoundShapeConstraint implements MigrationInterface {
  public name = 'AddRoundShapeConstraint'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rounds"
      ADD CONSTRAINT "CHK_rounds_valid_content_shape"
      CHECK (
        (
          "gameType" = 'quiz'
          AND (
            (
              "contentType" = 'question'
              AND "questionId" IS NOT NULL
              AND "codingChallengeId" IS NULL
              AND "puzzleId" IS NULL
            )
            OR (
              "contentType" = 'coding_challenge'
              AND "questionId" IS NULL
              AND "codingChallengeId" IS NOT NULL
              AND "puzzleId" IS NULL
            )
            OR (
              "contentType" = 'puzzle'
              AND "questionId" IS NULL
              AND "codingChallengeId" IS NULL
              AND "puzzleId" IS NOT NULL
            )
          )
        )
        OR (
          "gameType" <> 'quiz'
          AND "contentType" = 'puzzle'
          AND "questionId" IS NULL
          AND "codingChallengeId" IS NULL
          AND "puzzleId" IS NULL
          AND "seed" IS NOT NULL
          AND "publicState" IS NOT NULL
          AND "privateState" IS NOT NULL
          AND "scoringConfig" IS NOT NULL
        )
      )`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rounds" DROP CONSTRAINT "CHK_rounds_valid_content_shape"`)
  }
}

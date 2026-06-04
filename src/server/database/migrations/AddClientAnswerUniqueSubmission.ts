import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Enforce one answer per client per round at the database level.
 *
 * The ClientAnswer dedup invariant was previously only guarded in memory by
 * AnswerService; the table had no matching constraint. This adds the unique
 * index so duplicate submissions are rejected by the DB (the real backstop),
 * preventing double-scoring if the in-memory guard is ever bypassed.
 */
export class AddClientAnswerUniqueSubmission implements MigrationInterface {
  public name = 'AddClientAnswerUniqueSubmission'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_client_answers_unique_submission" ON "client_answers" ("clientId", "roundId")`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_client_answers_unique_submission"`)
  }
}

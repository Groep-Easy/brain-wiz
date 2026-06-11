import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddProceduralRoundState implements MigrationInterface {
  public name = 'AddProceduralRoundState'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rounds" ADD "gameType" character varying(64) NOT NULL DEFAULT 'quiz'`
    )
    await queryRunner.query(`ALTER TABLE "rounds" ADD "seed" character varying(128)`)
    await queryRunner.query(`ALTER TABLE "rounds" ADD "publicState" jsonb`)
    await queryRunner.query(`ALTER TABLE "rounds" ADD "privateState" jsonb`)
    await queryRunner.query(`ALTER TABLE "rounds" ADD "scoringConfig" jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rounds" DROP COLUMN "scoringConfig"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP COLUMN "privateState"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP COLUMN "publicState"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP COLUMN "seed"`)
    await queryRunner.query(`ALTER TABLE "rounds" DROP COLUMN "gameType"`)
  }
}

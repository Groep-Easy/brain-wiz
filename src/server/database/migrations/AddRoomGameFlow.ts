import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRoomGameFlow implements MigrationInterface {
  public name = 'AddRoomGameFlow'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" ADD "gameFlow" jsonb NOT NULL DEFAULT '[]'::jsonb`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rooms" DROP COLUMN "gameFlow"`)
  }
}

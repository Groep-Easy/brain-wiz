/**
 * @file add-used-questions-ids.ts
 * @description Database migration for tracking used question IDs in rooms.
 *
 * This migration:
 * - Adds the usedQuestionsIds column to track which questions have been asked
 * - This prevents duplicate questions from being asked in the same room
 */
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddUsedQuestionsIdsToRooms implements MigrationInterface {
  /**
   * Apply migration:
   * Add usedQuestionsIds column as UUID array with empty array default
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'rooms',
      new TableColumn({
        name: 'usedQuestionsIds',
        type: 'uuid',
        isArray: true,
        isNullable: false,
        default: 'ARRAY[]::uuid[]',
      })
    )
  }

  /**
   * Roll back migration:
   * Remove usedQuestionsIds column from rooms table
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rooms', 'usedQuestionsIds')
  }
}

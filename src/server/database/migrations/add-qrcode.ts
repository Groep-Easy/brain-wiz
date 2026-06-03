/**
 * @file add-qrcode.ts
 * @description Database migration for QR-code support in rooms.
 *
 * This migration:
 * - Adds the QR-code payload column used for join links
 * - Adds the generated QR-code SVG column
 * - Ensures both fields are required for new room records
 *
 * Existing rows receive temporary defaults during migration and the defaults
 * are removed afterwards to enforce explicit values on inserts.
 */
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class AddQrCodeToRooms implements MigrationInterface {
  /**
   * Apply migration:
   * 1. Add QR-code related columns
   * 2. Populate existing rows with temporary defaults
   * 3. Remove defaults so future inserts must provide values
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query('ALTER TABLE "rooms" ALTER COLUMN "qrCodePayload" DROP DEFAULT')
    await queryRunner.query('ALTER TABLE "rooms" ALTER COLUMN "qrCodeSvg" DROP DEFAULT')
  }

  /**
   * Roll back migration:
   * Remove all QR-code related columns from the rooms table.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rooms', 'qrCodeSvg')
    await queryRunner.dropColumn('rooms', 'qrCodePayload')
  }
}

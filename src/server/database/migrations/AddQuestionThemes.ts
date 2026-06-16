import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds the six new trivia themes (coding, films, gaming, general, internet,
 * music) to every Postgres enum that mirrors QuestionThemeEnum: the questions
 * table, the rooms `selectedThemes` array, and the game_blocks catalog. Without
 * these values the seeder cannot insert the themed test-data questions and the
 * host cannot offer the matching theme blocks.
 */
export class AddQuestionThemes implements MigrationInterface {
  public name = 'AddQuestionThemes'

  private static readonly NEW_VALUES = ['coding', 'films', 'gaming', 'general', 'internet', 'music']

  private static readonly OLD_VALUES = [
    'history',
    'science',
    'sport',
    'culture',
    'geography',
    'technology',
    'art',
    'other',
  ]

  private static readonly THEME_ENUMS = [
    'questions_theme_enum',
    'rooms_selectedthemes_enum',
    'game_blocks_theme_enum',
  ]

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const enumName of AddQuestionThemes.THEME_ENUMS) {
      for (const value of AddQuestionThemes.NEW_VALUES) {
        await queryRunner.query(
          `ALTER TYPE "public"."${enumName}" ADD VALUE IF NOT EXISTS '${value}'`
        )
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const oldValues = AddQuestionThemes.OLD_VALUES.map((v) => `'${v}'`).join(', ')

    // Postgres cannot drop a value from an enum, so each type is recreated with
    // only the original values and its column is re-cast. This fails if any row
    // still references one of the new themes (intended: reverting would lose it).
    const recreate = async (
      enumName: string,
      table: string,
      column: string,
      isArray: boolean
    ): Promise<void> => {
      const colType = isArray ? `"public"."${enumName}"[]` : `"public"."${enumName}"`
      const using = isArray
        ? `"${column}"::"text"[]::"public"."${enumName}"[]`
        : `"${column}"::"text"::"public"."${enumName}"`
      await queryRunner.query(`ALTER TYPE "public"."${enumName}" RENAME TO "${enumName}_old"`)
      await queryRunner.query(`CREATE TYPE "public"."${enumName}" AS ENUM(${oldValues})`)
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE ${colType} USING ${using}`
      )
      await queryRunner.query(`DROP TYPE "public"."${enumName}_old"`)
    }

    await recreate('questions_theme_enum', 'questions', 'theme', false)
    await recreate('rooms_selectedthemes_enum', 'rooms', 'selectedThemes', true)
    await recreate('game_blocks_theme_enum', 'game_blocks', 'theme', false)
  }
}

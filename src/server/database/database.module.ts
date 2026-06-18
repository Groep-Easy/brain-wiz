/**
 * @file src/server/database/database.module.ts
 * @description NestJS Database Module - TypeORM integration
 *
 * This module:
 * - Initializes TypeORM connection
 * - Validates database connectivity on startup
 * - Provides entity repositories to other modules
 * - Handles graceful connection cleanup on shutdown
 */
import { Module, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppDataSource } from './data-source'
import { QuestionSeederService } from './question-seeder.service'
import { BlockSeederService } from './block-seeder.service'
import * as entities from '../entities/index'

/**
 * Database initialization service
 * Handles startup/shutdown and connection validation
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
    }),
    TypeOrmModule.forFeature([
      entities.Question,
      entities.CodingChallenge,
      entities.Puzzle,
      entities.Room,
      entities.Client,
      entities.Round,
      entities.ClientAnswer,
      entities.GameBlock,
    ]),
  ],
  providers: [QuestionSeederService, BlockSeederService],
  exports: [TypeOrmModule, QuestionSeederService, BlockSeederService],
})
export class DatabaseModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name)

  /**
   * On application bootstrap:
   * 1. Initialize database connection (migrations run automatically on init in
   *    production via the DataSource `migrationsRun` option; see data-source.ts)
   * 2. Validate schema integrity
   */
  public async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Initializing database connection...')

    try {
      // Initialize connection if not already done
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize()
        this.logger.log('✓ Database connected successfully')
      }

      // Validate schema by running a simple query
      await this.validateSchema()
      this.logger.log('✓ Schema validation passed')
    } catch (error) {
      this.logger.error(
        `✗ Database initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * On application shutdown:
   * Close database connection gracefully
   */
  public async onApplicationShutdown(): Promise<void> {
    this.logger.log('Closing database connection...')

    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy()
        this.logger.log('✓ Database connection closed')
      }
    } catch (error) {
      this.logger.error(
        `✗ Error closing database: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Validate that schema is properly initialized
   * Runs a simple SELECT 1 query to verify connectivity
   */
  private async validateSchema(): Promise<void> {
    try {
      const result = await AppDataSource.query('SELECT 1')
      if (!result || result.length === 0) {
        throw new Error('Schema validation query returned no results')
      }
    } catch (error) {
      throw new Error(
        `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

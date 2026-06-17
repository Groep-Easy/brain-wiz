/**
 * @file src/server/database/data-source.ts
 * @description TypeORM DataSource configuration
 *
 * This file creates the TypeORM DataSource instance used for:
 * - Running the application (NestJS integration)
 * - Running migrations (TypeORM CLI)
 * - Seeding database
 * - Development queries
 *
 * IMPORTANT: This must be importable by both:
 * 1. NestJS application (at runtime)
 * 2. TypeORM CLI (for migrations)
 */
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { getDatabaseConfig } from '@config/database.config'
import * as entities from '../entities/index'

/**
 * Entity list - needed separately for TypeORM CLI
 * TypeORM CLI cannot use dynamic imports, so we list them explicitly
 */
const ENTITIES = [
  entities.Question,
  entities.CodingChallenge,
  entities.Puzzle,
  entities.Room,
  entities.Client,
  entities.Round,
  entities.ClientAnswer,
  entities.GameBlock,
]

/**
 * Create TypeORM DataSource
 * This is the single source of truth for database connection
 */
export function createDataSource(): DataSource {
  const dbConfig = getDatabaseConfig()

  return new DataSource({
    type: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    entities: ENTITIES,
    migrations: ['dist/server/database/migrations/**/*.js'],
    migrationsTableName: 'typeorm_migrations',
    synchronize: dbConfig.synchronize,
    dropSchema: dbConfig.dropSchema,
    logging: dbConfig.logging.enabled ? (['query', 'error'] as const) : (['error'] as const),
    logger: 'simple-console',
    ssl: dbConfig.ssl,
    maxQueryExecutionTime: dbConfig.query.timeout,
    poolSize: dbConfig.poolSize.max,
    cache: {
      type: 'database',
      // Must NOT be 'typeorm_metadata' — that name is reserved for TypeORM's
      // internal view/migration metadata table (columns type/name/value/...).
      // Pointing the query-result cache at it creates a table with cache
      // columns (id/identifier/time/duration/query/result), and schema sync's
      // loadViews() then fails with "column t.name does not exist".
      tableName: 'query-result-cache',
      duration: 30000, // Cache query results for 30s
    },
  })
}

/**
 * Export singleton instance
 * Used by application and CLI
 */
export const AppDataSource = createDataSource()

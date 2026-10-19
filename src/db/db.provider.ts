
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

@Injectable()
export class DrizzleProvider implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit(): Promise<void> {
    await this.checkConnection();
  }

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
    console.log('PostgreSQL connection successful');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}


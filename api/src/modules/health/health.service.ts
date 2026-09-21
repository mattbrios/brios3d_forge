import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

const QUERY_TIMEOUT_MS = 3000;

export interface HealthStatus {
  status: 'ok';
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), QUERY_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    } finally {
      clearTimeout(timer);
    }
    return { status: 'ok' };
  }
}

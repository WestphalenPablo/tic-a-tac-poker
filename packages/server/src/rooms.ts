import { seeded, type ErrorCode } from '@tatp/game';
import { randomBytes, randomInt } from 'node:crypto';
import { Table } from './table.js';

export const MAX_ROOMS = 500;

/** Registry of live rooms. Ids are unguessable: knowing the link is what lets a friend in. */
export class Rooms {
  private tables = new Map<string, Table>();

  constructor(private makeRng = () => seeded(randomInt(2 ** 32)), private max = MAX_ROOMS) {}

  get size(): number { return this.tables.size; }

  get(id: string): Table | undefined { return this.tables.get(id); }

  create(): Table | ErrorCode {
    if (this.tables.size >= this.max) return 'server_full';
    let id: string;
    do id = randomBytes(6).toString('base64url'); while (this.tables.has(id)); // 8 url-safe chars
    const table = new Table(id, this.makeRng(), (gone) => this.tables.delete(gone));
    this.tables.set(id, table);
    return table;
  }
}

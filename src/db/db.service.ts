
import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "./db.constants";

@Injectable()
export class DbService {
  constructor(
    @Inject(DRIZZLE)
    readonly db: ReturnType<typeof import("drizzle-orm/node-postgres").drizzle>,
  ) {}
}


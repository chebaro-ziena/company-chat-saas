
import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DrizzleProvider } from "./db.provider";
import { DRIZZLE } from "./db.constants";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DrizzleProvider,
    {
      provide: DRIZZLE,
      useFactory: (provider: DrizzleProvider) => provider.db,
      inject: [DrizzleProvider],
    },
  ],
  exports: [DRIZZLE, DrizzleProvider],
})
export class DbModule {}



import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
 
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new ConflictException(
        'Password must not exceed 72 bytes.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const [user] = await this.db
        .insert(schema.users)
        .values({
          name: dto.name.trim(),
          email,
          passwordHash,
        })
        .returning({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        });

      const accessToken = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
      });

      return { user, accessToken };
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      accessToken,
    };
  }
}


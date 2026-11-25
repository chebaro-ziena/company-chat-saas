
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookie(
    response: Response,
    accessToken: string,
  ): void {
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() request: AuthenticatedRequest) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }

    const [name, memberships] = await Promise.all([
      this.authService.getUserName(user.userId),
      this.authService.getMemberships(user.userId),
    ]);

    return {
      user: { ...user, name },
      memberships,
    };
  }

  @Post('register')
  @Throttle({ default: { ttl: 60 * 60_000, limit: 5 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);

    this.setAuthCookie(response, result.accessToken);

    return {
      message: 'Registration successful',
      user: result.user,
    };
  }

  @Post('login')
  @Throttle({ default: { ttl: 15 * 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    this.setAuthCookie(response, result.accessToken);

    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }
}

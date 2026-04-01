import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegisterTeacherDto } from './dto/register-teacher.dto.js';
import { RegisterVenueDto } from './dto/register-venue.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/teacher')
  registerTeacher(@Body() dto: RegisterTeacherDto, @Req() req: Request) {
    return this.authService.registerTeacher(dto, req.ip, req.headers['user-agent']);
  }

  @Post('register/venue')
  registerVenue(@Body() dto: RegisterVenueDto, @Req() req: Request) {
    return this.authService.registerVenue(dto, req.ip, req.headers['user-agent']);
  }

  @Post('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.demanderResetPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.reinitialiserMotDePasse(body.token, body.password);
  }

  @Get('sirene/:siret')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  searchSirene(@Param('siret') siret: string) {
    return this.authService.searchSirene(siret);
  }
}

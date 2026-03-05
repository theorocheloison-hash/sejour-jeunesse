import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
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
  registerTeacher(@Body() dto: RegisterTeacherDto) {
    return this.authService.registerTeacher(dto);
  }

  @Post('register/venue')
  registerVenue(@Body() dto: RegisterVenueDto) {
    return this.authService.registerVenue(dto);
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
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RegisterOrganisateurDto } from './dto/register-organisateur.dto.js';
import { RegisterHebergeurDto } from './dto/register-hebergeur.dto.js';
import { RegisterSignataireDto } from './dto/register-signataire.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser, type JwtUser } from './decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/organisateur')
  @Throttle({ default: { ttl: 3600000, limit: 10 } })   // 10/heure par IP
  registerOrganisateur(@Body() dto: RegisterOrganisateurDto, @Req() req: Request) {
    return this.authService.registerOrganisateur(dto, req.ip, req.headers['user-agent']);
  }

  @Post('register/hebergeur')
  @Throttle({ default: { ttl: 3600000, limit: 5 } })    // 5/heure par IP
  @UseInterceptors(FileInterceptor('document'))
  registerHebergeur(
    @Body() dto: RegisterHebergeurDto,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }
    return this.authService.registerHebergeur(dto, req.ip, req.headers['user-agent'], file);
  }

  @Post('register/signataire')
  @Throttle({ default: { ttl: 3600000, limit: 10 } })   // 10/heure par IP
  registerSignataire(@Body() dto: RegisterSignataireDto, @Req() req: Request) {
    return this.authService.registerSignataire(dto, req.ip, req.headers['user-agent']);
  }

  @Post('verify-email/:token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })   // 10/heure par IP (retry légitime possible)
  verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('renvoyer-magic-link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  renvoyerMagicLink(@Body() body: { email: string }) {
    return this.authService.renvoyerMagicLink(body.email);
  }

  @Get('magic/:token')
  async magicLink(@Param('token') token: string, @Res() res: Response) {
    return this.authService.consommerMagicLink(token, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 3600000, limit: 5 } })
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.demanderResetPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 900000 } })   // 5/15 min par IP (token sans MDP à valider)
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.reinitialiserMotDePasse(body.token, body.password);
  }

  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  setPassword(@CurrentUser() user: JwtUser, @Body() body: { password: string; ancienMotDePasse?: string }) {
    return this.authService.definirMotDePasse(user.id, body.password, body.ancienMotDePasse);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })  // 10/min par IP
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Get('sirene/:siret')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  searchSirene(@Param('siret') siret: string) {
    return this.authService.searchSirene(siret);
  }
}

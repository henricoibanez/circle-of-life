import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Equals, IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Public } from '../common/decorators';
import type { Env } from '../config/env';
import { AuthService } from './auth.service';
import { EmailCodeService } from './email-code.service';
import { isGoogleConfigured } from './google.strategy';
import { MIN_PASSWORD } from './password';
import { SessionService } from './session.service';

const PASSWORD_MSG = `a senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`;

class EmailDto {
  @IsEmail({}, { message: 'e-mail inválido' }) @MaxLength(200) email!: string;
}
class LoginDto extends EmailDto {
  @IsString() @MinLength(1, { message: 'digite a senha' }) @MaxLength(200) password!: string;
}
class SignupDto extends EmailDto {
  @IsString() @MinLength(2, { message: 'digite o seu nome' }) @MaxLength(80) name!: string;
  @IsString() @MinLength(MIN_PASSWORD, { message: PASSWORD_MSG }) @MaxLength(200) password!: string;
  @Equals(true, { message: 'é preciso aceitar os termos de uso' }) acceptTerms!: boolean;
}
class CodeDto extends EmailDto {
  @IsString() @Length(6, 6, { message: 'o código tem 6 números' }) code!: string;
}
class ResetDto extends CodeDto {
  @IsString() @MinLength(MIN_PASSWORD, { message: PASSWORD_MSG }) @MaxLength(200) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly session: SessionService,
    private readonly auth: AuthService,
    private readonly codes: EmailCodeService,
  ) {}

  /** Quais formas de entrar estão disponíveis (para a tela de login). */
  @Public()
  @Get('providers')
  providers() {
    return {
      google: isGoogleConfigured(this.config),
      dev: this.config.get('NODE_ENV') === 'development',
      convite: this.config.get('SIGNUP_MODE') === 'invite',
      // Cadastro e "esqueci minha senha" dependem do envio do código por e-mail.
      senha: this.codes.enabled,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(204)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.loginWithPassword(dto.email, dto.password);
    await this.session.start(res, user.id);
  }

  /** Cadastro com senha: manda o código de confirmação para o e-mail. */
  @Public()
  @Post('signup')
  @HttpCode(204)
  signup(@Body() dto: SignupDto) {
    return this.auth.signupStart(dto);
  }

  @Public()
  @Post('signup/verify')
  @HttpCode(204)
  async verify(@Body() dto: CodeDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.signupVerify(dto.email, dto.code);
    await this.session.start(res, user.id);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(204)
  forgot(@Body() dto: EmailDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body() dto: ResetDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.resetPassword(dto.email, dto.code, dto.password);
    await this.session.start(res, user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    this.session.end(res);
  }
}

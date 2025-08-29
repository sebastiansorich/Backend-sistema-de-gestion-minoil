import { Controller, Post, Body, Req, UseFilters, ValidationPipe, UsePipes, HttpCode, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from '../usuarios/dto/login.dto';
import { ChangePasswordDto } from '../usuarios/dto/change-password.dto';
import { ValidatePasswordDto } from '../usuarios/dto/validate-password.dto';
import { PasswordPolicyService } from './password-policy.service';
import { Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordPolicyService: PasswordPolicyService
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Autenticar usuario (LDAP o local)' })
  @ApiResponse({ status: 200, description: 'Usuario autenticado exitosamente' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.username, loginDto.password);
  }

  @Post('change-password')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Cambiar contraseña de usuario LDAP',
    description: 'Permite a un usuario cambiar su contraseña en LDAP. Requiere la contraseña actual para verificación.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña cambiada exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Contraseña cambiada exitosamente' }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Datos de entrada inválidos o contraseñas no coinciden',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Contraseña actual incorrecta o usuario no autorizado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Credenciales LDAP inválidas' },
        error: { type: 'string', example: 'Unauthorized' }
      }
    }
  })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request
  ) {
    // Extraer información del cliente para auditoría
    const clientIp = this.getClientIp(request);
    const userAgent = request.headers['user-agent'];

    // Usar la IP del DTO si está disponible, sino usar la detectada
    const finalClientIp = changePasswordDto.clientIp || clientIp;
    const finalUserAgent = changePasswordDto.userAgent || userAgent;

    return this.authService.changePassword(
      changePasswordDto.username,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      changePasswordDto.confirmPassword
    );
  }

  @Post('validate-password')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ 
    summary: 'Validar política de contraseña',
    description: 'Valida si una contraseña cumple con la política de seguridad de Minoil antes de intentar cambiarla.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Validación de contraseña completada',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean', example: true },
        strength: { type: 'string', enum: ['weak', 'fair', 'good', 'strong'], example: 'strong' },
        score: { type: 'number', minimum: 0, maximum: 100, example: 85 },
        errors: { type: 'array', items: { type: 'string' }, example: [] },
        suggestions: { type: 'array', items: { type: 'string' }, example: ['Use un gestor de contraseñas'] }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Datos de entrada inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'array', items: { type: 'string' } },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  async validatePassword(@Body() validatePasswordDto: ValidatePasswordDto) {
    const userInfo = {
      username: validatePasswordDto.username,
      nombre: validatePasswordDto.nombre,
      apellido: validatePasswordDto.apellido,
      email: validatePasswordDto.email
    };

    const validationResult = this.passwordPolicyService.validatePassword(
      validatePasswordDto.password,
      userInfo,
      this.passwordPolicyService.getMinoilPasswordPolicy()
    );

    const suggestions = this.passwordPolicyService.generatePasswordSuggestions(validationResult);

    return {
      ...validationResult,
      suggestions
    };
  }

  /**
   * Extrae la IP real del cliente considerando proxies y load balancers
   */
  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      (request.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  @Get('health')
  @ApiOperation({ summary: 'Verificar estado del sistema de autenticación' })
  @ApiResponse({ status: 200, description: 'Estado del sistema' })
  async health() {
    const config = {
      ldap: {
        url: process.env.LDAP_URL || 'No configurado',
        baseDN: process.env.LDAP_BASE_DN || 'No configurado',
        adminDN: process.env.LDAP_ADMIN_DN ? 'Configurado' : 'No configurado',
        adminPassword: process.env.LDAP_ADMIN_PASSWORD ? 'Configurado' : 'No configurado',
      },
      sap: {
        host: process.env.SAP_HANA_HOST || 'No configurado',
        port: process.env.SAP_HANA_PORT || 'No configurado',
        username: process.env.SAP_HANA_USERNAME || 'No configurado',
        password: process.env.SAP_HANA_PASSWORD ? 'Configurado' : 'No configurado',
      },
      database: {
        url: process.env.DATABASE_URL ? 'Configurado' : 'No configurado',
      },
      jwt: {
        secret: process.env.JWT_SECRET ? 'Configurado' : 'No configurado',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    };

    const missingConfig = [];
    if (!process.env.LDAP_ADMIN_DN) missingConfig.push('LDAP_ADMIN_DN');
    if (!process.env.LDAP_ADMIN_PASSWORD) missingConfig.push('LDAP_ADMIN_PASSWORD');
    if (!process.env.SAP_HANA_PASSWORD) missingConfig.push('SAP_HANA_PASSWORD');
    if (!process.env.DATABASE_URL) missingConfig.push('DATABASE_URL');
    if (!process.env.JWT_SECRET) missingConfig.push('JWT_SECRET');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      config,
      missingConfig,
      recommendations: missingConfig.length > 0 ? [
        'Configurar variables de entorno faltantes',
        'Verificar conectividad con LDAP y SAP HANA',
        'Asegurar que la base de datos esté accesible'
      ] : [
        'Sistema configurado correctamente',
        'Listo para autenticación híbrida'
      ]
    };
  }
} 
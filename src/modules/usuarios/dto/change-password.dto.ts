import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Nombre de usuario',
    example: 'ssorich'
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @MinLength(2, { message: 'El nombre de usuario debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'El nombre de usuario no puede tener más de 50 caracteres' })
  username: string;

  @ApiProperty({
    description: 'Contraseña actual del usuario',
    example: 'Clave123'
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  currentPassword: string;

  @ApiProperty({
    description: 'Nueva contraseña (mínimo 8 caracteres, debe incluir al menos 1 mayúscula y 1 número)',
    example: 'Minoil123'
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es requerida' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La nueva contraseña no puede tener más de 128 caracteres' })
  @Matches(
    /^(?=.*[A-Z])(?=.*\d)/,
    {
      message: 'La nueva contraseña debe contener al menos: 1 mayúscula y 1 número'
    }
  )
  newPassword: string;

  @ApiProperty({
    description: 'Confirmación de la nueva contraseña',
    example: 'Minoil123'
  })
  @IsString()
  @IsNotEmpty({ message: 'La confirmación de contraseña es requerida' })
  confirmPassword: string;

  @ApiProperty({
    description: 'Dirección IP del cliente (opcional, para auditoría)',
    example: '192.168.1.100',
    required: false
  })
  @IsOptional()
  @IsString()
  clientIp?: string;

  @ApiProperty({
    description: 'User-Agent del cliente (opcional, para auditoría)',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    required: false
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
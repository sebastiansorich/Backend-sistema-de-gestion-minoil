import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  timestamp: string;

  constructor(success: boolean, message: string, data?: T) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message = 'Operación exitosa'): BaseResponseDto<T> {
    return new BaseResponseDto(true, message, data);
  }

  static error(message: string): BaseResponseDto<null> {
    return new BaseResponseDto(false, message, null);
  }
}

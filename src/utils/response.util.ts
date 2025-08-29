import { BaseResponseDto } from '@/common/dto/base-response.dto';

export class ResponseUtil {
  static success<T>(data: T, message = 'Operación exitosa'): BaseResponseDto<T> {
    return BaseResponseDto.success(data, message);
  }

  static error(message: string): BaseResponseDto<null> {
    return BaseResponseDto.error(message);
  }

  static paginated<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Datos obtenidos exitosamente'
  ) {
    return BaseResponseDto.success({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    }, message);
  }
}

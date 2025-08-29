import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorHandlerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(error => {
        // Si ya es un HttpException, la dejamos pasar
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // Log del error para debugging
        console.error('Error no manejado:', error);

        // Convertir errores de Prisma a HttpException
        if (error.code) {
          switch (error.code) {
            case 'P2002':
              return throwError(() => new HttpException(
                'Ya existe un registro con estos datos',
                HttpStatus.CONFLICT
              ));
            case 'P2025':
              return throwError(() => new HttpException(
                'Registro no encontrado',
                HttpStatus.NOT_FOUND
              ));
            case 'P2003':
              return throwError(() => new HttpException(
                'Error de referencia: registro relacionado no existe',
                HttpStatus.BAD_REQUEST
              ));
            default:
              return throwError(() => new HttpException(
                'Error interno del servidor',
                HttpStatus.INTERNAL_SERVER_ERROR
              ));
          }
        }

        // Error genérico
        return throwError(() => new HttpException(
          'Error interno del servidor',
          HttpStatus.INTERNAL_SERVER_ERROR
        ));
      }),
    );
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


// Configuración de CORS más específica
app.enableCors({
  origin: [
    'http://localhost:5173', // Vite dev server
    'http://localhost:3001', // Alternativo
    'http://127.0.0.1:5173', // IP local
    'http://127.0.0.1:3001'  // IP local alternativo
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With', 
    'Content-Type', 
    'Accept',
    'Authorization',
    'accept'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
});

  // Configuración de validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Minoil API')
    .setDescription('API del sistema empresarial Minoil para gestión de usuarios, jerarquías y permisos')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('sedes', 'Gestión de sedes')
    .addTag('areas', 'Gestión de áreas')
    .addTag('cargos', 'Gestión de cargos y jerarquías')
    .addTag('roles', 'Gestión de roles')
    .addTag('usuarios', 'Gestión de usuarios y autenticación')
    .addTag('modulos', 'Gestión de módulos del sistema')
    .addTag('permisos', 'Gestión de permisos por rol y módulo')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
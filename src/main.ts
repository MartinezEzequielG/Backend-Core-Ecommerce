import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaExceptionFilter } from './shared/prisma-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Si estás detrás de Nginx/ALB/CloudFront, esto ayuda a:
  // - req.ip correcto (rate limit)
  // - cookies secure en algunos escenarios
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir SSR, server-to-server y null origin
      if (!origin || origin === 'null') {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization, x-session-id, x-csrf-token',
    exposedHeaders: 'set-cookie',
  });

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'V',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new PrismaExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, doc);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // webhook raw
  app.use('/api/V1/payments/webhook', bodyParser.raw({ type: '*/*' }));

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}
bootstrap();
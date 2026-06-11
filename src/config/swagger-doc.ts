import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger'

export function setSwaggerConfig(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Brain-wiz server REST API endpoints')
    .setVersion(process.env['SERVER_API_VERSION'] ?? '1.0')
    .addTag('')
    .build()
  const documentFactory = (): OpenAPIObject => SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api', app, documentFactory)
}

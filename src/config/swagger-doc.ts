import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";


export function setSwaggerConfig(app: INestApplication<any>) {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Brain-wiz server REST API endpoints')
    .setVersion(process.env["SERVER_API_VERSION"] ?? "1.0")
    .addTag('')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, documentFactory);
}


import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix if needed (mirroring crm-api patterns)
  app.setGlobalPrefix("api/marketplace");

  const port = process.env.MARKETPLACE_API_PORT || 8001;
  await app.listen(port);
  console.log(`🚀 Marketplace API is running on: http://localhost:${port}/api`);
}
bootstrap();

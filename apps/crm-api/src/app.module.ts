import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthService } from './auth/auth.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SubscriptionGuard } from './common/guards/subscription.guard';
import { SessionService } from './session/session.service';
import { TelemetryModule } from './telemetry/telemetry.module';
import { VehiclesController } from './vehicles/vehicles.controller';
import { VehiclesService } from './vehicles/vehicles.service';
import { DriversModule } from './drivers/drivers.module';
import { DriversController } from './drivers/drivers.controller';
import { DriversService } from './drivers/drivers.service';
import { RulesEngineService } from './rules-engine/rules-engine.service';
import { ScoringCronService } from './scoring-cron/scoring-cron.service';
import { ScoringController } from './scoring-cron/scroring-cron.controller';
import { AssignmentService } from './assignment/assignment.service';
import { AwsRoutesClientService } from './scoring-cron/aws-routes-client.service';
import { HereRoutesClientService } from './scoring-cron/here-routes-client.service';
import { OverspeedCalculationService } from './scoring-cron/overspeed-calculation.service';
import { TelemetryRollupService } from './scoring-cron/telemetry-rollup.service';
import { WeeklyScoringService } from './scoring-cron/weekly-scoring.service';
import { ScoringCronScheduler } from './scoring-cron/scoring-cron-scheduler.service';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from './common/cache.module';
import { InvitationsModule } from './invitations/invitations.module';
import { DriverDocumentsModule } from './driver-documents/driver-documents.module';
import { BillingModule } from './modules/billing/billing.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [
    AppController,
    VehiclesController,
    DriversController,
    ScoringController,
  ],
  providers: [
    AppService,
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    SessionService,
    VehiclesService,
    DriversService,
    RulesEngineService,
    ScoringCronService,
    AwsRoutesClientService,
    HereRoutesClientService,
    OverspeedCalculationService,
    TelemetryRollupService,
    WeeklyScoringService,
    ScoringCronScheduler,
    AssignmentService,
  ],
  imports: [
    UsersModule,
    AuthModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    OrganizationsModule,
    TelemetryModule,
    DriversModule,
    VehiclesModule,
    CacheModule,
    InvitationsModule,
    DriverDocumentsModule,
    BillingModule,
    HttpModule,
  ],
})
export class AppModule {}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScoringCronService } from './scoring-cron.service';
import { WeeklyScoringService } from './weekly-scoring.service';

@Injectable()
export class ScoringCronScheduler {
  private readonly logger = new Logger(ScoringCronScheduler.name);

  constructor(
    private readonly scoringCronService: ScoringCronService,
    private readonly weeklyScoringService: WeeklyScoringService,
  ) {}

  @Cron('0 2 * * *', {
    timeZone: 'America/Panama',
  }) // Todos los días a las 2:00 AM
  async handleDailyRollup() {
    this.logger.log('Cron Trigger: Daily Telemetry Rollup');
    try {
      await this.scoringCronService.runDailyRollup();
    } catch (error) {
      this.logger.error('Error running daily telemetry rollup cron:', error);
    }
  }

  @Cron('0 3 * * 1', {
    timeZone: 'America/Panama',
  }) // Lunes a las 3:00 AM
  async handleWeeklyScoring() {
    this.logger.log('Cron Trigger: Weekly Scoring');
    try {
      await this.weeklyScoringService.runWeeklyScoring();
    } catch (error) {
      this.logger.error('Error running weekly scoring cron:', error);
    }
  }
}

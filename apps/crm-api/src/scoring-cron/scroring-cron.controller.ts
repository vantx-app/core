// src/scoring/debug-scoring.controller.ts
import { Body, Controller, Post, Get } from '@nestjs/common';
import { ScoringCronService } from './scoring-cron.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringCron: ScoringCronService) {}

  @Post('trigger-daily-batch')
  async triggerDailyRollup(@Body('targetDate') targetDate?: string) {
    const start = Date.now();
    await this.scoringCron.runDailyRollup(targetDate);
    const duration = Date.now() - start;

    return {
      success: true,
      targetDate,
      message: 'Batch de Scoring diario ejecutado manualmente.',
      executionTimeMs: duration,
    };
  }

  @Post('trigger-weekly-batch')
  async triggerBatchManually() {
    const start = Date.now();
    await this.scoringCron.runWeeklyScoring();
    const duration = Date.now() - start;

    return {
      success: true,
      message: 'Batch de Scoring semanal ejecutado manualmente.',
      executionTimeMs: duration,
    };
  }

  @Public()
  @Get('public-rules')
  async getPublicRules() {
    return this.scoringCron.getPublicRules();
  }
}

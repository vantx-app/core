import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { InvitationsController } from './invitations.controller';
import { RegisterController } from './register.controller';
import { InvitationsService } from './invitations.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [InvitationsController, RegisterController],
  providers: [InvitationsService, PrismaService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

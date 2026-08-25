import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ethProviderFactory } from './eth-provider';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ethProviderFactory],
})
export class PaymentsModule {}
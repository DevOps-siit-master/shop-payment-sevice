import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('verify')
  verify(@Body() dto: VerifyPaymentDto) {
    return this.payments.verify(dto.orderId, dto.txHash);
  }
}
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsString() @IsNotEmpty()
  orderId!: string;

  @IsString() @IsNotEmpty()
  txHash!: string;
}
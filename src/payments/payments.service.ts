import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Interface, JsonRpcProvider, parseUnits } from 'ethers';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  private readonly usdt = (process.env.USDT_ADDRESS ?? '').toLowerCase();
  private readonly shopWallet = (process.env.SHOP_WALLET_ADDRESS ?? '').toLowerCase();
  private readonly orderApi = process.env.ORDER_SERVICE_URL ?? 'http://localhost:3000';

  async verify(orderId: string, txHash: string) {
    const orderRes = await fetch(`${this.orderApi}/orders/${orderId}`);
    if (!orderRes.ok) throw new BadRequestException('Order not found');
    const order = await orderRes.json();
    const expected = parseUnits(order.total, 6);

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      throw new BadRequestException('Transaction not found or not confirmed');
    }

    const iface = new Interface([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);
    const paid = receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== this.usdt) return false;
      try {
        const parsed = iface.parseLog(log);
        return (
          parsed?.name === 'Transfer' &&
          parsed.args.to.toLowerCase() === this.shopWallet &&
          parsed.args.value >= expected
        );
      } catch {
        return false;
      }
    });
    if (!paid) {
      throw new BadRequestException('No valid USDT payment found in this transaction');
    }

    const patchRes = await fetch(`${this.orderApi}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', txHash }),
    });
    if (!patchRes.ok) throw new BadRequestException('Failed to update order status');

    this.logger.log(`Order ${orderId} marked PAID (tx ${txHash})`);
    return { orderId, status: 'PAID', txHash };
  }
}

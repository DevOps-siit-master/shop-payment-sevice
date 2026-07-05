import { BadRequestException } from '@nestjs/common';
import { id, toBeHex, zeroPadValue } from 'ethers';
import { PaymentsService } from './payments.service';

const TOKEN = '0x1111111111111111111111111111111111111111';
const SHOP = '0x2222222222222222222222222222222222222222';
const BUYER = '0x3333333333333333333333333333333333333333';
const TX = '0xabc';
const ORDER_ID = 'order-1';

const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');

function transferLog(token: string, to: string, value: bigint) {
  return {
    address: token,
    topics: [TRANSFER_TOPIC, zeroPadValue(BUYER, 32), zeroPadValue(to, 32)],
    data: toBeHex(value, 32),
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let getReceipt: jest.Mock;

  beforeEach(() => {
    service = new PaymentsService();
    getReceipt = jest.fn();
    (service as any).provider = { getTransactionReceipt: getReceipt };
    (service as any).usdt = TOKEN.toLowerCase();
    (service as any).shopWallet = SHOP.toLowerCase();
    (service as any).orderApi = 'http://order';
  });

  function mockOrder(total: string) {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  }

  it('marks the order PAID for a valid USDT transfer to the shop wallet', async () => {
    mockOrder('25.000000');
    getReceipt.mockResolvedValue({
      status: 1,
      logs: [transferLog(TOKEN, SHOP, 25_000_000n)],
    });

    const result = await service.verify(ORDER_ID, TX);

    expect(result).toEqual({ orderId: ORDER_ID, status: 'PAID', txHash: TX });
    expect((global as any).fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects when the transaction is not confirmed', async () => {
    mockOrder('25.000000');
    getReceipt.mockResolvedValue(null);
    await expect(service.verify(ORDER_ID, TX)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the payment goes to a different address', async () => {
    mockOrder('25.000000');
    getReceipt.mockResolvedValue({
      status: 1,
      logs: [transferLog(TOKEN, BUYER, 25_000_000n)],
    });
    await expect(service.verify(ORDER_ID, TX)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the amount is too low', async () => {
    mockOrder('25.000000');
    getReceipt.mockResolvedValue({
      status: 1,
      logs: [transferLog(TOKEN, SHOP, 10_000_000n)],
    });
    await expect(service.verify(ORDER_ID, TX)).rejects.toBeInstanceOf(BadRequestException);
  });
});



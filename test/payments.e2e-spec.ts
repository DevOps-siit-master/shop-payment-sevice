import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Contract, JsonRpcProvider, parseUnits, Wallet } from 'ethers';
import request from 'supertest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { ETH_PROVIDER } from '../src/payments/eth-provider';
import { PaymentsModule } from '../src/payments/payments.module';
import { startOrderApiStub, type OrderApiStub } from './fixtures/order-api';
import { deployTestToken } from './fixtures/token';

jest.setTimeout(180_000);

const ORDER_ID = 'order-1';
const ORDER_TOTAL = '25.000000';
const UNKNOWN_TX = '0x' + '11'.repeat(32);

describe('Payments (integration)', () => {
  let anvil: StartedTestContainer;
  let provider: JsonRpcProvider;
  let app: INestApplication;
  let orderApi: OrderApiStub;
  let token: Contract;
  let shopWallet: string;

  beforeAll(async () => {
    anvil = await new GenericContainer('ghcr.io/foundry-rs/foundry:latest')
      .withCommand(['anvil --host 0.0.0.0'])
      .withExposedPorts(8545)
      .withWaitStrategy(Wait.forListeningPorts())
      .withStartupTimeout(120_000)
      .start();

    const rpcUrl = 'http://' + (anvil.getHost() || '127.0.0.1') + ':' + anvil.getMappedPort(8545);
    provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });

    const deployed = await deployTestToken(provider, parseUnits('1000', 6));
    token = deployed.token as unknown as Contract;
    shopWallet = Wallet.createRandom().address;

    orderApi = await startOrderApiStub({ [ORDER_ID]: { total: ORDER_TOTAL } });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SEPOLIA_RPC_URL: rpcUrl,
              USDT_ADDRESS: deployed.address,
              SHOP_WALLET_ADDRESS: shopWallet,
              ORDER_SERVICE_URL: orderApi.url,
            }),
          ],
        }),
        PaymentsModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    (app?.get(ETH_PROVIDER) as JsonRpcProvider | undefined)?.destroy();
    provider?.destroy();
    await app?.close();
    await orderApi?.close();
    await anvil?.stop();
  });

  async function pay(to: string, amount: string): Promise<string> {
    const tx = await token.transfer(to, parseUnits(amount, 6));
    await tx.wait();
    return tx.hash;
  }

  it('marks the order PAID for a matching on-chain transfer', async () => {
    const txHash = await pay(shopWallet, '25');

    const res = await request(app.getHttpServer())
      .post('/payments/verify')
      .send({ orderId: ORDER_ID, txHash })
      .expect(201);

    expect(res.body).toEqual({ orderId: ORDER_ID, status: 'PAID', txHash });
    expect(orderApi.patches).toContainEqual({
      orderId: ORDER_ID,
      status: 'PAID',
      txHash,
    });
  });

  it('rejects a transfer smaller than the order total', async () => {
    const txHash = await pay(shopWallet, '10');

    await request(app.getHttpServer())
      .post('/payments/verify')
      .send({ orderId: ORDER_ID, txHash })
      .expect(400);
  });

  it('rejects a transfer that went to a different address', async () => {
    const txHash = await pay(Wallet.createRandom().address, '25');

    await request(app.getHttpServer())
      .post('/payments/verify')
      .send({ orderId: ORDER_ID, txHash })
      .expect(400);
  });

  it('rejects a transaction that does not exist on chain', async () => {
    await request(app.getHttpServer())
      .post('/payments/verify')
      .send({ orderId: ORDER_ID, txHash: UNKNOWN_TX })
      .expect(400);
  });

  it('rejects an unknown order', async () => {
    const txHash = await pay(shopWallet, '25');

    await request(app.getHttpServer())
      .post('/payments/verify')
      .send({ orderId: 'does-not-exist', txHash })
      .expect(400);
  });
});
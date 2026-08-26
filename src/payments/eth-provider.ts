import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider, Provider } from 'ethers';

export const ETH_PROVIDER = Symbol('ETH_PROVIDER');

export const ethProviderFactory = {
    provide: ETH_PROVIDER,
    inject: [ConfigService],
    useFactory: (config: ConfigService): Provider => {
        const url = config.get<string>('SEPOLIA_RPC_URL') || 'http://127.0.0.1:8545';
        return new JsonRpcProvider(url, undefined, { staticNetwork: true });
    }
};
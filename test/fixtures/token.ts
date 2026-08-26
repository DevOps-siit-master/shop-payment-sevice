import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContractFactory, Wallet, type Provider, type InterfaceAbi, type ContractTransactionResponse, BaseContract, NonceManager } from 'ethers';
import { compile } from 'solc';

// Anvil's default mnemonic; account #0 is prefunded. Deriving the key from it
// beats hard-coding a private key, and the chain is thrown away after the test.
const ANVIL_MNEMONIC =
  'test test test test test test test test test test test junk';

interface CompiledContract {
  abi: InterfaceAbi;
  evm: { bytecode: { object: string } };
}

export interface TestToken extends BaseContract {
  transfer(to: string, amount: bigint): Promise<ContractTransactionResponse>;
}

function compileTestToken(): CompiledContract {
  const source = readFileSync(join(__dirname, 'TestToken.sol'), 'utf8');

  const output = JSON.parse(
    compile(
      JSON.stringify({
        language: 'Solidity',
        sources: { 'TestToken.sol': { content: source } },
        settings: {
          outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
        },
      }),
    ),
  );

  const errors = (output.errors ?? []).filter(
    (e: { severity: string }) => e.severity === 'error',
  );
  if (errors.length > 0) {
    throw new Error(`solc failed: ${JSON.stringify(errors)}`);
  }

  return output.contracts['TestToken.sol'].TestToken as CompiledContract;
}

export async function deployTestToken(provider: Provider, supply: bigint) {
  const { abi, evm } = compileTestToken();
  const deployer = new NonceManager(Wallet.fromPhrase(ANVIL_MNEMONIC).connect(provider));

  const factory = new ContractFactory(abi, evm.bytecode.object, deployer);
  const token = (await factory.deploy(supply)) as unknown as TestToken;
  await token.waitForDeployment();

  return { token, address: await token.getAddress(), deployer };
}
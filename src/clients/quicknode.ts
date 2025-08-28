import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';

const RPC_URL = process.env.QUICKNODE_RPC_URL || clusterApiUrl('mainnet-beta');

export function getSolanaConnection(): Connection {
  return new Connection(RPC_URL, { commitment: 'confirmed' });
}

/**
 * Get simple token account balance in lamports (wrapper)
 */
export async function getAccountBalance(pubkey: string): Promise<number> {
  const connection = getSolanaConnection();
  const publicKey = new PublicKey(pubkey);
  const balance = await connection.getBalance(publicKey);
  return balance;
}
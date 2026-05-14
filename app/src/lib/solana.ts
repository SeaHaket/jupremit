import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

// Server-side only — never expose a secret RPC key via NEXT_PUBLIC_
export function getConnection(): Connection {
  const rpc = process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

/** Sign + send a base64 VersionedTransaction from Jupiter Ultra /order */
export async function signAndSendBase64Tx(
  base64Tx: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  connection: Connection
): Promise<string> {
  const buf    = Buffer.from(base64Tx, "base64");
  const tx     = VersionedTransaction.deserialize(buf);
  const signed = await signTransaction(tx);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const sig    = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries:    3,
  });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

/** Direct USDC transfer — mainnet mint, creates recipient ATA if absent */
export async function buildUsdcTransferTx(
  fromPubkey: PublicKey,
  toPubkey:   PublicKey,
  amountLamports: number,
  connection: Connection
): Promise<Transaction> {
  const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
  } = await import("@solana/spl-token");

  const USDC_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

  const fromAta = await getAssociatedTokenAddress(USDC_MAINNET, fromPubkey);
  const toAta   = await getAssociatedTokenAddress(USDC_MAINNET, toPubkey);

  const tx = new Transaction();

  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    tx.add(createAssociatedTokenAccountInstruction(fromPubkey, toAta, toPubkey, USDC_MAINNET));
  }

  tx.add(
    createTransferInstruction(fromAta, toAta, fromPubkey, BigInt(amountLamports), [], TOKEN_PROGRAM_ID)
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  return tx;
}

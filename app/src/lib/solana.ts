import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

export function getConnection(): Connection {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
  return new Connection(rpc, "confirmed");
}

/** Sign + send a base64 transaction from Jupiter Ultra /order */
export async function signAndSendBase64Tx(
  base64Tx: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  connection: Connection
): Promise<string> {
  const buf = Buffer.from(base64Tx, "base64");
  const tx  = VersionedTransaction.deserialize(buf);
  const signed = await signTransaction(tx);
  const sig    = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/** Direct USDC transfer (no swap) — for plain recipient sends */
export async function buildUsdcTransferTx(
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountLamports: number, // in USDC base units (6 decimals)
  connection: Connection
): Promise<Transaction> {
  const {
    createTransferInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
  } = await import("@solana/spl-token");

  const USDC_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

  const fromAta = await getAssociatedTokenAddress(USDC_DEVNET, fromPubkey);
  const toAta   = await getAssociatedTokenAddress(USDC_DEVNET, toPubkey);

  const tx = new Transaction();

  // Create recipient ATA if it doesn't exist
  const toAtaInfo = await connection.getAccountInfo(toAta);
  if (!toAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        fromPubkey, toAta, toPubkey, USDC_DEVNET
      )
    );
  }

  tx.add(
    createTransferInstruction(
      fromAta, toAta, fromPubkey,
      BigInt(amountLamports),
      [], TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubkey;

  return tx;
}

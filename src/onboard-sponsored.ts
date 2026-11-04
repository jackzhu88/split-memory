// One-off onboarding via the relayer's official sponsored-tx flow (same as dashboard). No secrets printed.
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createSponsorAuthorization } from "@mysten-incubation/memwal";
import { generateDelegateKey } from "@mysten-incubation/memwal/account";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "fs";

const R = "https://relayer.memory.walrus.xyz";
const W = "secrets/sui-wallet.json";
const cfg = await (await fetch(`${R}/config`)).json();
const client = new SuiGrpcClient({ baseUrl: cfg.suiGrpcUrl, network: "mainnet" });

let w: any;
if (!existsSync(W)) {
  const mnemonic = generateMnemonic(wordlist);
  const kp = Ed25519Keypair.deriveKeypair(mnemonic);
  w = { address: kp.toSuiAddress(), mnemonic, privateKey: kp.getSecretKey(), createdAt: new Date().toISOString() };
  writeFileSync(W, JSON.stringify(w, null, 2)); chmodSync(W, 0o600);
} else w = JSON.parse(readFileSync(W, "utf8"));
const kp = Ed25519Keypair.fromSecretKey(w.privateKey);
const addr = kp.toSuiAddress();
console.log("address", addr);
const bal = await client.getBalance({ owner: addr });
console.log("SUI balance (mist)", bal.balance.balance);
if (process.argv[2] === "wallet-only") process.exit(0);

async function sponsored(tx: Transaction) {
  const kind = await tx.build({ client, onlyTransactionKind: true });
  const auth = await createSponsorAuthorization(addr, kind, (m) => kp.signPersonalMessage(m).then(r => ({ signature: r.signature })));
  const r1 = await fetch(`${R}/sponsor`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionBlockKindBytes: Buffer.from(kind).toString("base64"), sender: addr, ...auth }) });
  if (!r1.ok) throw new Error(`sponsor ${r1.status} ${await r1.text()}`);
  const v = await r1.json();
  const { signature } = await kp.signTransaction(Buffer.from(v.bytes, "base64"));
  const r2 = await fetch(`${R}/sponsor/execute`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ digest: v.digest, sender: addr, signature }) });
  if (!r2.ok) throw new Error(`execute ${r2.status} ${await r2.text()}`);
  const { digest } = await r2.json();
  const r: any = await client.waitForTransaction({ digest, include: { effects: true, objectTypes: true } });
  const t = r.Transaction ?? r.FailedTransaction ?? r;
  const created = (t.effects?.changedObjects ?? []).filter((c: any) => c.idOperation === "Created").map((c: any) => ({ objectId: c.objectId, objectType: t.objectTypes?.[c.objectId] }));
  return { digest, status: t.effects?.status, gasUsed: t.effects?.gasUsed, created };
}

const ev: any = { createdAt: new Date().toISOString(), network: "mainnet", owner: addr, packageId: cfg.packageId, registryId: cfg.registryId };
let accountId = w.accountId;
if (!accountId) {
  const tx = new Transaction();
  tx.moveCall({ target: `${cfg.packageId}::account::create_account`, arguments: [tx.object(cfg.registryId), tx.object("0x6")] });
  const res: any = await sponsored(tx);
  ev.createAccountDigest = res.digest; ev.createAccountStatus = res.status; ev.createAccountGas = res.gasUsed;
  accountId = res.created.find((c: any) => /::account::/.test(c.objectType ?? "") && !/Key|Cap/.test(c.objectType))?.objectId;
  if (!accountId) { console.log(JSON.stringify(res.created)); throw new Error("no account id"); }
  w.accountId = accountId; writeFileSync(W, JSON.stringify(w, null, 2));
}
ev.accountId = accountId;
console.log("accountId", accountId);

const d = await generateDelegateKey();
const tx2 = new Transaction();
tx2.moveCall({ target: `${cfg.packageId}::account::add_delegate_key`, arguments: [tx2.object(accountId), tx2.object(cfg.registryId), tx2.pure.vector("u8", Array.from(d.publicKey)), tx2.pure.string("total-recall-split"), tx2.object("0x6")] });
const r2: any = await sponsored(tx2);
ev.addDelegateDigest = r2.digest; ev.addDelegateStatus = r2.status; ev.delegateAddress = d.suiAddress;
w.delegatePrivateKey = d.privateKey; w.delegateAddress = d.suiAddress; writeFileSync(W, JSON.stringify(w, null, 2));

let env = readFileSync("secrets/.env", "utf8");
const set = (k: string, v: string) => { env = new RegExp(`^${k}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : env + `\n${k}=${v}\n`; };
set("MEMWAL_KEY", d.privateKey); set("MEMWAL_ACCOUNT_ID", accountId); set("SUI_ADDRESS", addr);
writeFileSync("secrets/.env", env); chmodSync("secrets/.env", 0o600);
ev.balanceAfterMist = (await client.getBalance({ owner: addr })).balance.balance;
const f = `evidence/onboard-${Date.now()}.json`; writeFileSync(f, JSON.stringify(ev, null, 2));
console.log("ok", f, ev.createAccountDigest, ev.addDelegateDigest);

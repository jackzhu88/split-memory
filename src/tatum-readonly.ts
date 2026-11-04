/**
 * Tatum Sui readonly helpers for Total Recall "where relevant" integration.
 *
 * Product rule: Tatum is READONLY. No writes, no paid upgrades from this module.
 *
 * Endpoint status (verified 2026-11-04):
 * - GraphQL mainnet gateway works: https://sui-mainnet.gateway.tatum.io/graphql
 *   Auth header: x-api-key
 * - JSON-RPC on the same host returns 404 (do not use).
 * - gRPC is still documented by Tatum but not required for this MVP demo.
 */
import { loadEnv, optionalEnv, requireEnv } from "./env.ts";

/** Documented / verified Tatum Sui endpoints. */
export const TATUM_SUI = {
  graphqlMainnet: "https://sui-mainnet.gateway.tatum.io/graphql",
  grpcMainnet: "sui-mainnet-grpc.gateway.tatum.io:443",
  /** JSON-RPC host still listed in older docs — returns 404 as of 2026-11-04. */
  jsonRpcGatewayMainnet: "https://sui-mainnet.gateway.tatum.io",
} as const;

export function requireTatumApiKey(): string {
  loadEnv();
  return requireEnv("TATUM_API_KEY");
}

export type TatumChainHint = {
  ok: true;
  source: "tatum-sui-graphql";
  gateway: string;
  checkpoint: {
    sequenceNumber: number;
    timestamp: string | null;
    digest: string | null;
  };
  address?: {
    address: string;
    suiBalanceMist: string;
  };
};

async function tatumGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const apiKey = requireTatumApiKey();
  const res = await fetch(TATUM_SUI.graphqlMainnet, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!res.ok) {
    throw new Error(
      `Tatum GraphQL HTTP ${res.status}: ${(body.errors ?? []).map((e) => e.message).join("; ") || "request failed"}`,
    );
  }
  if (body.errors?.length) {
    throw new Error(
      `Tatum GraphQL error: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!body.data) {
    throw new Error("Tatum GraphQL returned empty data");
  }
  return body.data;
}

/**
 * Readonly live read via Tatum Sui GraphQL.
 * Returns latest checkpoint (+ optional SUI balance for SUI_ADDRESS).
 * Never prints or returns the API key.
 */
export async function fetchPublicChainHint(): Promise<TatumChainHint> {
  type CheckpointData = {
    checkpoint: {
      sequenceNumber: number;
      timestamp?: string | null;
      digest?: string | null;
    };
  };

  const checkpointData = await tatumGraphql<CheckpointData>(
    `query {
      checkpoint {
        sequenceNumber
        timestamp
        digest
      }
    }`,
  );

  const result: TatumChainHint = {
    ok: true,
    source: "tatum-sui-graphql",
    gateway: TATUM_SUI.graphqlMainnet,
    checkpoint: {
      sequenceNumber: checkpointData.checkpoint.sequenceNumber,
      timestamp: checkpointData.checkpoint.timestamp ?? null,
      digest: checkpointData.checkpoint.digest ?? null,
    },
  };

  const address = optionalEnv("SUI_ADDRESS");
  if (address) {
    type BalanceData = {
      address: {
        address: string;
        balance: { totalBalance: string } | null;
      } | null;
    };
    const bal = await tatumGraphql<BalanceData>(
      `query ($a: SuiAddress!) {
        address(address: $a) {
          address
          balance(coinType: "0x2::sui::SUI") { totalBalance }
        }
      }`,
      { a: address },
    );
    if (bal.address) {
      result.address = {
        address: bal.address.address,
        suiBalanceMist: bal.address.balance?.totalBalance ?? "0",
      };
    }
  }

  return result;
}

async function main(): Promise<void> {
  try {
    requireTatumApiKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tatum] credential check failed: ${message}`);
    process.exit(1);
  }

  console.log("[tatum] TATUM_API_KEY is set (value not printed).");
  console.log(`[tatum] GraphQL: ${TATUM_SUI.graphqlMainnet}`);

  try {
    const hint = await fetchPublicChainHint();
    console.log("[tatum] readonly ok");
    console.log(
      `[tatum] checkpoint=${hint.checkpoint.sequenceNumber} digest=${hint.checkpoint.digest ?? "(none)"}`,
    );
    if (hint.address) {
      console.log(
        `[tatum] address=${hint.address.address.slice(0, 10)}… sui_mist=${hint.address.suiBalanceMist}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[tatum] ${message}`);
    process.exit(2);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[tatum] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

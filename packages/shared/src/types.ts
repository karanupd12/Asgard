// JSON shapes returned by the Go API (apps/api/internal/repo, httpapi).

export type Address = `0x${string}`;

export interface RuntimeConfig {
  chainId: number;
  contractAddress: Address;
  gatewayUrl: string;
  storageProvider: "kubo" | "pinata";
  maxUploadMb: number;
}

export interface VaultFile {
  id: number;
  owner: Address;
  cid: string;
  thumbCid: string | null;
  chainFileId: number | null;
  status: "pending" | "confirmed" | "removed";
  encrypted: boolean;
  title: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  tags: string[];
  txHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
  /** File key wrapped for the requesting user (encrypted files only). */
  wrappedKey: string | null;
}

export interface FilePage {
  files: VaultFile[];
  nextCursor: number | null;
  ownerPublicKey: string | null;
}

export interface UploadResult {
  file: VaultFile;
  digest: `0x${string}`;
  codec: number;
}

export interface Usage {
  files: number;
  bytes: number;
  encrypted: number;
  pending: number;
}

export interface Me {
  address: Address;
  publicKey: string | null;
  usage: Usage;
}

export interface Album {
  id: number;
  name: string;
  fileCount: number;
  createdAt: string;
  cover: VaultFile | null;
}

export interface Grant {
  address: Address;
  grantedAt: string;
  hasPublicKey: boolean;
}

export interface SharedOwner {
  owner: Address;
  fileCount: number;
  grantedAt: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface GasEstimate {
  files: number;
  gasPriceWei: string;
  gasPerFile: number;
  totalGas: number;
  totalCostWei: string;
  cachedAt: string;
}

export interface MissingKey {
  fileId: number;
  recipient: Address;
}

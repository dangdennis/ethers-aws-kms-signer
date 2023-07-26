import { ethers, hashMessage, Transaction } from "ethers";
import {
  getPublicKey,
  getEthereumAddress,
  requestKmsSignature,
  determineCorrectV,
} from "./util/aws-kms-utils";
import { KMSClient } from "@aws-sdk/client-kms";

export class AwsKmsSigner implements ethers.AbstractSigner {
  readonly kms: KMSClient;
  readonly keyId: string;
  readonly provider: ethers.Provider | null;
  ethereumAddress: string;

  constructor(keyId: string, kms: KMSClient, provider: ethers.Provider) {
    this.keyId = keyId;
    this.provider = provider;
    this.kms = kms;
  }

  async getAddress(): Promise<string> {
    if (this.ethereumAddress === undefined) {
      const key = await getPublicKey(this.keyId, this.kms);
      this.ethereumAddress = getEthereumAddress(Buffer.from(key));
    }
    return Promise.resolve(this.ethereumAddress);
  }

  async _signDigest(digestString: string): Promise<string> {
    const digestBuffer = Buffer.from(ethers.getBytes(digestString));
    const sig = await requestKmsSignature(
      {
        keyId: this.keyId,
        plaintext: digestBuffer,
      },
      this.kms
    );
    const ethAddr = await this.getAddress();
    const { v } = determineCorrectV(digestBuffer, sig.r, sig.s, ethAddr);
    return ethers.Signature.from({
      v,
      r: `0x${sig.r.toString("hex")}`,
      s: `0x${sig.s.toString("hex")}`,
    }).serialized;
  }

  async signMessage(message: string | ethers.BytesLike): Promise<string> {
    return this._signDigest(hashMessage(message));
  }

  async signTransaction(transaction: ethers.TransactionLike): Promise<string> {
    const unsignedTx = await Transaction.from(transaction);
    const transactionSignature = await this._signDigest(
      ethers.keccak256(unsignedTx.unsignedSerialized)
    );
    unsignedTx.signature = transactionSignature;
    return unsignedTx.serialized;
  }

  connect(provider: ethers.Provider): AwsKmsSigner {
    return new AwsKmsSigner(this.keyId, this.kms, provider);
  }

  getNonce(blockTag?: ethers.BlockTag): Promise<number> {
    throw new Error("Method not implemented.");
  }

  populateCall(
    tx: ethers.TransactionRequest
  ): Promise<ethers.TransactionLike<string>> {
    throw new Error("Method not implemented.");
  }

  populateTransaction(
    tx: ethers.TransactionRequest
  ): Promise<ethers.TransactionLike<string>> {
    throw new Error("Method not implemented.");
  }

  estimateGas(tx: ethers.TransactionRequest): Promise<bigint> {
    throw new Error("Method not implemented.");
  }

  resolveName(name: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  sendTransaction(
    tx: ethers.TransactionRequest
  ): Promise<ethers.TransactionResponse> {
    throw new Error("Method not implemented.");
  }

  call(tx: ethers.TransactionRequest): Promise<string> {
    throw new Error("Method not implemented.");
  }

  signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    throw new Error("Method not implemented.");
  }
}

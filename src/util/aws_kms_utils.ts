import { recoverAddress, keccak256 } from "ethers";
import {
  KMSClient,
  SignCommand,
  GetPublicKeyCommand,
} from "@aws-sdk/client-kms";
import * as asn1 from "asn1.js";

type BN = bigint;

/* this asn1.js library has some funky things going on */
/* eslint-disable func-names */

const EcdsaSigAsnParse: {
  decode: (asnStringBuffer: Buffer, format: "der") => { r: BN; s: BN };
} =
  // rome-ignore lint/suspicious/noExplicitAny: <explanation>
  asn1.define("EcdsaSig", function (this: any) {
    // parsing this according to https://tools.ietf.org/html/rfc3279#section-2.2.3
    this.seq().obj(this.key("r").int(), this.key("s").int());
  });

// rome-ignore lint/suspicious/noExplicitAny: <explanation>
const EcdsaPubKey = asn1.define("EcdsaPubKey", function (this: any): void {
  // parsing this according to https://tools.ietf.org/html/rfc5480#section-2
  this.seq().obj(
    this.key("algo").seq().obj(this.key("a").objid(), this.key("b").objid()),
    this.key("pubKey").bitstr()
  );
});

export async function sign(
  input: { digest: Buffer; keyId: string },
  kms: KMSClient
) {
  const res = await kms.send(
    new SignCommand({
      // key id or 'Alias/<alias>'
      KeyId: input.keyId,
      Message: input.digest,
      // 'ECDSA_SHA_256' is the one compatible with ECC_SECG_P256K1.
      SigningAlgorithm: "ECDSA_SHA_256",
      MessageType: "DIGEST",
    })
  );
  return res.Signature;
}

export async function getPublicKey(keyId: string, kms: KMSClient) {
  return (await kms.send(new GetPublicKeyCommand({ KeyId: keyId }))).PublicKey;
}

export function getEthereumAddress(publicKey: Buffer): string {
  // The public key is ASN1 encoded in a format according to
  // https://tools.ietf.org/html/rfc5480#section-2
  // I used https://lapo.it/asn1js to figure out how to parse this
  // and defined the schema in the EcdsaPubKey object
  const res = EcdsaPubKey.decode(publicKey, "der");
  let pubKeyBuffer: Buffer = res.pubKey.data;

  // The public key starts with a 0x04 prefix that needs to be removed
  // more info: https://www.oreilly.com/library/view/mastering-ethereum/9781491971932/ch04.html
  pubKeyBuffer = pubKeyBuffer.slice(1, pubKeyBuffer.length);

  const address = keccak256(pubKeyBuffer); // keccak256 hash of publicKey
  const EthAddr = `0x${address.slice(-40)}`; // take last 20 bytes as ethereum adress
  return EthAddr;
}

export function findEthereumSig(signature: Buffer) {
  const decoded = EcdsaSigAsnParse.decode(signature, "der");
  const r = BigInt(decoded.r);
  const s = BigInt(decoded.s);

  const secp256k1N = BigInt(
    "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"
  ); // max value on the curve
  const secp256k1halfN = secp256k1N / 2n; // half of the curve
  // Because of EIP-2 not all elliptic curve signatures are accepted
  // the value of s needs to be SMALLER than half of the curve
  // i.e. we need to flip s if it's greater than half of the curve
  // if s is less than half of the curve, we're on the "good" side of the curve, we can just return

  // console.log({
  //   r,
  //   s,
  //   secp256k1N,
  //   bigIntsecp256k1N: BigInt(secp256k1N),
  //   secp256k1halfN,
  //   bigIntsecp256k1halfN: BigInt(secp256k1halfN),
  // });

  return { r, s: s > secp256k1halfN ? secp256k1N - s : s };
}

export async function requestKmsSignature(
  input: { plaintext: Buffer; keyId: string },
  kms: KMSClient
) {
  try {
    const signature = await sign(
      {
        digest: input.plaintext,
        keyId: input.keyId,
      },
      kms
    );
    if (!signature) {
      throw new Error("AWS KMS call failed: no signature");
    }

    return findEthereumSig(Buffer.from(signature));
  } catch (error) {
    throw new Error(`AWS KMS call failed: ${error}`);
  }
}

function recoverPubKeyFromSig(msg: Buffer, r: bigint, s: bigint, v: number) {
  return recoverAddress(`0x${msg.toString("hex")}`, {
    r: `0x${r.toString(16)}`,
    s: `0x${s.toString(16)}`,
    v,
  });
}

export function determineCorrectV(
  msg: Buffer,
  r: bigint,
  s: bigint,
  expectedEthAddr: string
) {
  // This is the wrapper function to find the right v value
  // There are two matching signatues on the elliptic curve
  // we need to find the one that matches to our public key
  // it can be v = 27 or v = 28
  let v = 27;
  let pubKey = recoverPubKeyFromSig(msg, r, s, v);
  if (pubKey.toLowerCase() !== expectedEthAddr.toLowerCase()) {
    // if the pub key for v = 27 does not match
    // it has to be v = 28
    v = 28;
    pubKey = recoverPubKeyFromSig(msg, r, s, v);
  }
  return { pubKey, v };
}

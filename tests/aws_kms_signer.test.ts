import { KMSClient } from "@aws-sdk/client-kms";
import { describe, expect, test } from "vitest";
import { config } from "dotenv";
import { AwsKmsSigner } from "../src";
import { Contract, JsonRpcProvider, TransactionResponse } from "ethers";
import assert from "assert";
import { abi as YomiGardensAbi } from "./YomiGardens.json";

describe.skip("aws kms signer", () => {
  config();

  const keyId = process.env.KEY_ID;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  assert(keyId);
  assert(accessKeyId);
  assert(secretAccessKey);

  const kms = new KMSClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      sessionToken: sessionToken,
    },
  });
  const provider = new JsonRpcProvider("http://127.0.0.1:8545/");
  const signer = new AwsKmsSigner(keyId, kms, provider);
  const expectedKeyAddress = "0x7ca2eb4ba8b49b543a00fc50ba8f2c5c1150d17b";

  // @todo setup msw for CI testing
  test("can get the ethereum address", async () => {
    const address = await signer.getAddress();
    expect(address).toEqual(expectedKeyAddress);
  });

  // @todo setup hardhat for CI testing
  test("successfully signs and sends a transaction to a hardhat node", async () => {
    const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // generated after deploying a contract to hardhat
    const YomiGardens = new Contract(contractAddress, YomiGardensAbi, signer);

    const tx = (await YomiGardens.safeMint(expectedKeyAddress, 2, {
      gasLimit: "1000000",
    })) as TransactionResponse;

    await tx.wait();
  });
});

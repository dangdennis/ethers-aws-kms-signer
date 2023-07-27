import { KMSClient } from "@aws-sdk/client-kms";
import { describe, expect, test } from "vitest";
import { config } from "dotenv";
import { AwsKmsSigner } from ".";
import { Contract, JsonRpcProvider } from "ethers";
import { abi as YomiGardensAbi } from "./YomiGardens.json";

describe("aws kms signer", () => {
  config();

  const kms = new KMSClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
  });
  const provider = new JsonRpcProvider("http://127.0.0.1:8545/");
  const signer = new AwsKmsSigner(process.env.KEY_ID, kms, provider);
  const expectedKeyAddress = "0x7ca2eb4ba8b49b543a00fc50ba8f2c5c1150d17b";

  test("can get the ethereum address", async () => {
    const address = await signer.getAddress();
    expect(address).toEqual(expectedKeyAddress);
  });

  test("successfully signs and sends a transaction to a hardhat node", async () => {
    const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // generated after deploying a contract to hardhat
    const YomiGardens = new Contract(contractAddress, YomiGardensAbi, signer);

    const tx = await YomiGardens.safeMint(expectedKeyAddress, 2, {
      gasLimit: "1000000",
    });

    await tx.wait();
  });
});

# ethers-aws-kms-signer

This is an Ethers@v6 Signer that can be used together with [Ethers.js](https://github.com/ethers-io/ethers.js/) applications, using AWS KMS as the key storage.
For GCP KMS look [here](https://github.com/openlawteam/ethers-gcp-kms-signer)

## Getting Started

```sh
npm i @dennisdang/ethers-aws-kms-signer
```

```js
import { AwsKmsSigner } from "ethers-aws-kms-signer";

const kms = new KMSClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: "x",
    secretAccessKey: "y",
    sessionToken: "z", // required if using temporary credentials
  },
});

const provider = new JsonRpcProvider("rpc endpoint");
const signer = new AwsKmsSigner(
  "db3e7082-2b67-49a8-a7e1-092d52a1b2b8",
  kms,
  provider
);
const SomeContract = new Contract(
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  yourJsonAbi,
  signer
);

const tx = await SomeContract.mint("to-address", tokenId);

await tx.wait();

console.log(tx);
```

# Development

## Install

1. clone repo
2. `npm i`

## Commands

```sh
$ npm test # run tests
$ npm run check # lint and format code
$ npm run build # generate docs and transpile code
$ npx tsc --watch # typecheck in watch mode
```

## License

MIT © [Dennis Dang](https://github.com/dangdennis)

# Credits

Credit goes to RJ Chow's original library [ethers-aws-kms-signer](https://github.com/rjchow/ethers-aws-kms-signer). I've updated the library to use the latest version of ethers and simplified the tooling for my personal tastes (Rome, Vitest).

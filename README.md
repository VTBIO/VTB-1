# VTB

Vehicle to Everything Blockchain Token Smart Contract

## Setup

### Prerequisites on Ubuntu

```bash
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm -g i yarn
```

### Prerequisites macOS

```bash
brew tap ethereum/ethereum
brew install node yarn solidity
```

### Common setup

```bash
git clone https://github.com/yoyocat/VTB.git
cd VTB/
yarn install
```

Compile with
```bash
yarn build
```

Run test suite continuously:
```bash
yarn test --watch
```

### Web interface

Run a local development chain with:

```bash
yarn chain
```

Then in a separate terminal start an auto-updating web server:

```bash
yarn web
```

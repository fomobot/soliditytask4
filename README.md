# soliditytask4

Build a vanity name registering system resistant against frontrunning.
The purpose of the name is outside the scope of the assignment and you can make
reasonable assumptions on the size, encoding, etc of the name to complete in time.
An unregistered name can be registered for a certain amount of time by locking a certain
balance of an account. After the registration expires, the account loses ownership of the
name and his balance is unlocked. The registration can be renewed by making an on-chain
call to keep the name registered and balance locked.
You can assume reasonable defaults for the locking amount and period.
The fee to register the name depends directly on the size of the name. Also, a malicious
node/validator should not be able to front-run the process by censoring transactions of an
honest user and registering its name in its own account.

# Assumptions
* Min name size is 3 characters
* Max name size is 80 characters for convenience
* Balances are in ether
* Time is measured in blocks
* locked funds are considered as payment when renewing registry
* Only 1 name per address
* Period is expressed in blocks.
* Locking amount is 10 Wei per byte per period Configurable at contractor
* Max name size is 256 characters
* 6400 blocks per day
* secret encoding should be implemented on locally (view `secretEcondingHelper`)

# Instructions

## Usage

### Commands
```sh
# Install dependencies
npm install
# Configure mnemonic (or generate your own)
cp .secret.example .secret

# Run blockchain Service
npm run private-network

# Run lint checker
npm run lint-check

# Run lint fixer
npm run lint-fix

# Run tests
npm run test

# Run coverage
npm run coverage
```

### Contract Interaction

1. Registering a secret
To register a name safely from a frot running attack one must register a secret as a
commit message including.
This secret must be built with the following data in this exact same order using the
`registerSecret` function:
* `string` Name to regiter
* `address` of the wallet who intends to register the name
* `uint256` Value in ether intended as payment for the registration
* `uint256` blockCount value of the amount of blocks the name is intended for registration

2. Registering a name
Once this commit secret is properly registered, a name can be registered via the
`register` function.

3. Renewal is available for the name owner once the name has been registered via the
   `renew` function.

5. Locked funds on the registration can be used as part of the payment when renewing a
   registration.

6. If the name expires its block count allocation a new user can register the name


Further documentation can be found at the contract's `natspace`.

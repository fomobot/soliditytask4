const Names = artifacts.require("Names");

const BigNumber = require("bignumber.js");
const { time } = require("@openzeppelin/test-helpers");

require("chai")
  .use(require("chai-as-promised"))
  .use(require("chai-bignumber")(BigNumber))
  .should();

const pricePerChar = 10;
const blocksInADay = 6400;
const blocksInAYear = blocksInADay * 365;
const zeroAddress = "0x0000000000000000000000000000000000000000";

let names;
let tenLetterWord = "Friendship";

contract("Names", async (accounts) => {
  const USER_1 = accounts[1];
  const USER_2 = accounts[2];

  beforeEach(async function () {
    names = await Names.new(pricePerChar);
  });

  describe("Unregistered Names", async function () {
    beforeEach(async function () {
      // init contract
    });

    it("block certain balance when registering a name", async function () {
      let userBalanceStart = BigNumber(await web3.eth.getBalance(USER_1));
      await names.register(tenLetterWord, 10, {
        value: 1000,
        from: USER_1,
        gasPrice: 0,
      });

      let contractBalance = BigNumber(await web3.eth.getBalance(names.address));
      contractBalance.should.be.bignumber.equal(1000);

      let userBalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));

      userBalanceEnd.should.be.bignumber.equal(userBalanceStart.minus(1000));
    });

    it("return balance excess", async function () {
      let paymentExcess = 10000;
      let userBalanceStart = BigNumber(await web3.eth.getBalance(USER_1));

      await names.register(tenLetterWord, 10, {
        value: 1000 + paymentExcess,
        from: USER_1,
        gasPrice: 0,
      });

      let contractBalance = BigNumber(await web3.eth.getBalance(names.address));
      let userBalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));

      userBalanceEnd.should.be.bignumber.equal(userBalanceStart.minus(1000));
      contractBalance.should.be.bignumber.equal(1000);
    });

    it("should register a name for a certain amount of time", async function () {
      await names.register(tenLetterWord, 10, { value: 1000 });
      let expiration = BigNumber(await names.getExpiration(tenLetterWord));

      let currentBlock = await web3.eth.getBlock("latest");
      let expectedExpiration = currentBlock.number + 10;

      expiration.should.be.bignumber.equal(expectedExpiration);
    });

    it("not let register the name again", async function () {
      await names.register(tenLetterWord, 10, { value: 1000 });
      await names
        .register(tenLetterWord, 10, { value: 1000 })
        .should.be.rejectedWith(Error, "Can not register twice");
    });

    it("resolve to 0x0", async function () {
      let nameOwner = await names.resolve("randomName");
      nameOwner.should.be.equal(zeroAddress);
    });

    it("not register a name if payment is insufficient", async function () {
      await names
        .register(tenLetterWord, 10, { value: 100 })
        .should.be.rejectedWith(Error, "Payment is insufficient");

      let isRegistered = await names.isRegistered(tenLetterWord);
      isRegistered.should.be.equal(false);
    });

    it("register a name if payment is insufficient", async function () {
      await names.register(tenLetterWord, 10, { value: 1000, from: USER_1 });
      isRegistered = await names.isRegistered(tenLetterWord);
      nameOwner = await names.resolve(tenLetterWord);

      isRegistered.should.be.equal(true);
      nameOwner.should.be.equal(USER_1);
    });

    it("charge configured amout per character", async function () {
      let charge = BigNumber(await names.getRegistryPrice(tenLetterWord, 10));
      charge.should.be.bignumber.equal(1000);
      let chargePerDay = BigNumber(
        await names.getRegistryPrice(tenLetterWord, blocksInADay)
      );
      chargePerDay.should.be.bignumber.equal(640000);
      let chargePerYear = BigNumber(
        await names.getRegistryPrice(tenLetterWord, blocksInAYear)
      );
      chargePerYear.should.be.bignumber.equal(233600000);
    });
  });

  describe("Registered Names", async function () {
    beforeEach(async function () {
      await names.register(tenLetterWord, 10, { value: 1000, from: USER_1 });
    });

    it("be renewable by name owner before expiration", async function () {
      await names.renew(tenLetterWord, 10, { from: USER_1 });
      let currentBlock = await web3.eth.getBlockNumber();

      let newExpiration = BigNumber(await names.getExpiration(tenLetterWord));
      newExpiration.should.be.bignumber.equal(currentBlock + 10);
    });

    it("should reuse locked balance when renewing", async function () {
      let userBalanceStart = BigNumber(await web3.eth.getBalance(USER_1));
      let contractBalanceStart = BigNumber(
        await web3.eth.getBalance(names.address)
      );

      await names.renew(tenLetterWord, 10, {
        value: 0,
        from: USER_1,
        gasPrice: 0,
      });

      let contractBalanceEnd = BigNumber(
        await web3.eth.getBalance(names.address)
      );
      let userBalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));

      userBalanceEnd.should.be.bignumber.equal(userBalanceStart);
      contractBalanceStart.should.be.bignumber.equal(1000);
      contractBalanceEnd.should.be.bignumber.equal(1000);
    });

    it("renew return locked balance", async function () {
      let userBalanceStart = BigNumber(await web3.eth.getBalance(USER_1));
      let contractBalanceStart = BigNumber(
        await web3.eth.getBalance(names.address)
      );

      await names.renew(tenLetterWord, 11, {
        value: 200,
        from: USER_1,
        gasPrice: 0,
      });

      let contractBalanceEnd = BigNumber(
        await web3.eth.getBalance(names.address)
      );
      let userBalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));

      userBalanceEnd.should.be.bignumber.equal(userBalanceStart.minus(100));
      contractBalanceStart.should.be.bignumber.equal(1000);
      contractBalanceEnd.should.be.bignumber.equal(1100);
    });

    it("not be renewable by other users", async function () {
      await names
        .renew(tenLetterWord, 10, { value: 1000, from: USER_2 })
        .should.be.rejectedWith(Error, "Not the name owner");
    });

    it("resolve to name owner address when registered and not expired", async function () {
      let nameOwner = await names.resolve(tenLetterWord);
      nameOwner.should.be.equal(USER_1);
    });

    it("unalbe to withdraw locked balance", async function () {
      await names
        .withdraw(tenLetterWord, { from: USER_1, gasPrice: 0 })
        .should.be.rejectedWith(Error, "Balance is locked");
    });
  });

  describe("Expired Names", async function () {
    beforeEach(async function () {
      await names.register(tenLetterWord, 10, { value: 1000, from: USER_1 });
      let currentBlock = await web3.eth.getBlockNumber();
      await time.advanceBlockTo(currentBlock + 10);
    });

    it("lose ownership", async function () {
      let isOwner = await names.isRegistered(tenLetterWord);
      isOwner.should.be.equal(false);
    });

    it("renew expired by original user", async function () {
      await names.renew(tenLetterWord, 10, { value: 1000, from: USER_1 });
    });

    it("withdraw locked balance after expired", async function () {
      let userBalanceStart = BigNumber(await web3.eth.getBalance(USER_1));

      let lockedBalance = BigNumber(
        await names.getLockedBalance(tenLetterWord)
      );

      await names.withdraw(tenLetterWord, { from: USER_1, gasPrice: 0 });
      await time.advanceBlock();

      let userBalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));

      userBalanceEnd.should.be.bignumber.equal(
        userBalanceStart.plus(lockedBalance)
      );
    });

    it("unlock balance only by name owner", async function () {
      await names
        .withdraw(tenLetterWord, { from: USER_2, gasPrice: 0 })
        .should.be.rejectedWith(Error, "Not the name owner");
    });

    it("deregister name when unlocked", async function () {
      await names.withdraw(tenLetterWord, { from: USER_1, gasPrice: 0 });

      let expiration = BigNumber(await names.getExpiration(tenLetterWord));
      let isRegistered = await names.isRegistered(tenLetterWord);
      let owner = await names.resolve(tenLetterWord);
      let lockedBalance = BigNumber(
        await names.getLockedBalance(tenLetterWord)
      );

      expiration.should.be.bignumber.equal(0);
      isRegistered.should.be.equal(false);
      owner.should.be.equal(zeroAddress);
      lockedBalance.should.be.bignumber.equal(0);
    });

    it("be able to be registered by anyone", async function () {
      names.register(tenLetterWord, 10, { value: 1000, from: USER_2 });
    });

    it("resolve to 0x0 when expired", async function () {
      let nameOwner = await names.resolve(tenLetterWord);
      nameOwner.should.be.equal(zeroAddress);
    });

    it("not renewable by new user", async function () {
      await names
        .renew(tenLetterWord, 10, { value: 1000, from: USER_2 })
        .should.be.rejectedWith(Error, "Not the name owner");
    });

    it("registrable by other users", async function () {
      await names.register(tenLetterWord, 10, { value: 1000, from: USER_2 });
    });

    it("eject original user locked balance when registering with a new user", async function () {
      let user1BalanceStart = BigNumber(await web3.eth.getBalance(USER_1));
      let user2BalanceStart = BigNumber(await web3.eth.getBalance(USER_2));

      let lockedAmount = BigNumber(await names.getLockedBalance(tenLetterWord));

      await names.register(tenLetterWord, 10, {
        value: 1000,
        from: USER_2,
        gasPrice: 0,
      });

      let user1BalanceEnd = BigNumber(await web3.eth.getBalance(USER_1));
      let user2BalanceEnd = BigNumber(await web3.eth.getBalance(USER_2));

      user1BalanceEnd.should.be.bignumber.equal(
        user1BalanceStart.plus(lockedAmount)
      );
      user2BalanceEnd.should.be.bignumber.equal(user2BalanceStart.minus(1000));
    });
  });

  describe("front-running protection", async function () {
    it("safly commit desired domain", async function () {
      let secret = await names.secretEcondingHelper(
        tenLetterWord,
        USER_1,
        1000,
        10
      );

      await names.registerSecret(secret);

      let isValid = await names.validateSecret(
        secret,
        tenLetterWord,
        USER_1,
        1000,
        10
      );

      isValid.should.be.equal(true);

      await names.safeRegister(secret, tenLetterWord, 10, {
        value: 1000,
        from: USER_1,
        gasPrice: 0,
      });
    });
  });
});

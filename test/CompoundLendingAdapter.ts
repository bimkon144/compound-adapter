import { time, loadFixture, mineUpTo } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";


describe("Lock", function () {
  const decimalsBigInt = 10n ** 18n;
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;
    const comptroller = "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B" //comptroller
    const cTokenA = "0xFAce851a4921ce59e912d19329929CE6da6EB0c7"; //cLink
    const cTokenB = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"; //cDAi 
    const tokenA = "0x514910771AF9Ca656af840dff83E8264EcF986CA"// Link
    const tokenB = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //DAI
    const linkAbi = require('./abi/Link.json');
    const daiAbi = require('./abi/Dai.json');
    const abiCTokenA = require('./abi/cLink.json');
    const abiCTokenB = require('./abi/cDai.json');
    const abiComptroller = require('./abi/comptroller.json')
    const tokenAContract = new ethers.Contract(tokenA, linkAbi, owner);
    const tokenBContract = new ethers.Contract(tokenB, daiAbi, owner);
    const cTokenAContract = new ethers.Contract(cTokenA, abiCTokenA, owner);
    const cTokenBContract = new ethers.Contract(cTokenB, abiCTokenB, owner);
    const comptrollerContract = new ethers.Contract(comptroller, abiComptroller, owner);

    const richUser = await ethers.getImpersonatedSigner("0xf977814e90da44bfa03b6295a0616a897441acec");
    await tokenAContract.connect(richUser).transfer(owner.address, (100 * Math.pow(10, 18)).toString());
    await tokenBContract.connect(richUser).transfer(owner.address, (100 * Math.pow(10, 18)).toString());
    await tokenBContract.connect(richUser).transfer(otherAccount.address, (200 * Math.pow(10, 18)).toString());

    const CompoundLendingAdapter = await ethers.getContractFactory("CompoundLendingAdapter");
    const compoundLendingAdapter = await CompoundLendingAdapter.deploy("0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", "0xFAce851a4921ce59e912d19329929CE6da6EB0c7", "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643");

    return { compoundLendingAdapter, cTokenA, cTokenB, tokenA, tokenB, owner, otherAccount, tokenAContract, tokenBContract, cTokenAContract, cTokenBContract, comptrollerContract };
  }


  describe("Deployment", function () {
    it("Should set the right token Addresses", async function () {
      const { compoundLendingAdapter, cTokenA, cTokenB, tokenA, tokenB, } = await loadFixture(deployOneYearLockFixture);

      expect(await compoundLendingAdapter.cTokenA()).to.equal(cTokenA);
      expect(await compoundLendingAdapter.cTokenB()).to.equal(cTokenB);
      expect(await compoundLendingAdapter.tokenA()).to.equal(tokenA);
      expect(await compoundLendingAdapter.tokenB()).to.equal(tokenB);
    });

    it("Should add underlying token link to cLink and mint cLink back to adapter", async function () {
      const { compoundLendingAdapter, tokenAContract, cTokenAContract } = await loadFixture(deployOneYearLockFixture);
      await tokenAContract.approve(compoundLendingAdapter.address, (10 * Math.pow(10, 18)).toString());
      expect(Math.round(await cTokenAContract.balanceOf(compoundLendingAdapter.address) / Math.pow(10, 8))).eq(0);
      expect(Math.round(await cTokenAContract.callStatic.balanceOfUnderlying(compoundLendingAdapter.address) / Math.pow(10, 8))).eq(0);
      await compoundLendingAdapter.addCollateral(10n * decimalsBigInt);
      expect(Math.round(await cTokenAContract.callStatic.balanceOfUnderlying(compoundLendingAdapter.address) / Math.pow(10, 18))).eq(10);
      expect(Math.round(await cTokenAContract.balanceOf(compoundLendingAdapter.address) / Math.pow(10, 8))).eq(496);
    });

    it("Should withdraw underlying token back to adapter", async function () {
      const { compoundLendingAdapter, owner, tokenAContract, cTokenAContract } = await loadFixture(deployOneYearLockFixture);
      await tokenAContract.approve(compoundLendingAdapter.address, (10 * Math.pow(10, 18)).toString());
      await compoundLendingAdapter.addCollateral(10n * decimalsBigInt);
      expect(Math.round(await cTokenAContract.callStatic.balanceOfUnderlying(compoundLendingAdapter.address) / Math.pow(10, 18))).eq(10);
      const lastBalanceOfTokenA = Math.round(await tokenAContract.balanceOf(owner.address) / Math.pow(10, 18));
      await compoundLendingAdapter.withdrawCollateral(10n * decimalsBigInt);
      expect(Math.round(await cTokenAContract.callStatic.balanceOfUnderlying(compoundLendingAdapter.address) / Math.pow(10, 18))).eq(0);
      expect(Math.round(await tokenAContract.balanceOf(owner.address) / Math.pow(10, 18))).to.eq(lastBalanceOfTokenA + 10);
    });

    it("Should that adapter entered the market", async function () {
      const { compoundLendingAdapter, comptrollerContract, cTokenA } = await loadFixture(deployOneYearLockFixture);
      expect(await comptrollerContract.checkMembership(compoundLendingAdapter.address, cTokenA)).to.eq(true);
    });

    it("Should borrow token DAI", async function () {
      const { compoundLendingAdapter, tokenAContract, tokenBContract, owner } = await loadFixture(deployOneYearLockFixture);
      await tokenAContract.approve(compoundLendingAdapter.address, (100 * Math.pow(10, 18)).toString());
      await compoundLendingAdapter.addCollateral(100n * decimalsBigInt);
      const lastBalanceOfTokenB = Math.round(await tokenBContract.balanceOf(owner.address) / Math.pow(10, 18));
      await compoundLendingAdapter.borrow(10n * decimalsBigInt)
      expect(Math.round(await tokenBContract.balanceOf(owner.address) / Math.pow(10, 18))).to.eq(lastBalanceOfTokenB + 10);
    });

    it("Should repay borrow ", async function () {
      const { compoundLendingAdapter, tokenAContract, tokenBContract, owner } = await loadFixture(deployOneYearLockFixture);
      await tokenAContract.approve(compoundLendingAdapter.address, (100 * Math.pow(10, 18)).toString());
      await compoundLendingAdapter.addCollateral(100n * decimalsBigInt);
      const lastBalanceOfTokenB = Math.round(await tokenBContract.balanceOf(owner.address) / Math.pow(10, 18));
      await compoundLendingAdapter.borrow(10n * decimalsBigInt)
      expect(Math.round(await tokenBContract.balanceOf(owner.address) / Math.pow(10, 18))).to.eq(lastBalanceOfTokenB + 10);
      await tokenBContract.approve(compoundLendingAdapter.address, (10 * Math.pow(10, 18)).toString());
      await compoundLendingAdapter.repayBorrow(10n * decimalsBigInt);
      expect(Math.round(await tokenBContract.balanceOf(owner.address) / Math.pow(10, 18))).to.eq(lastBalanceOfTokenB);

    });

    it("Should liqduidate ", async function () {
      const {otherAccount, compoundLendingAdapter, tokenAContract, tokenBContract, owner, comptrollerContract, cTokenBContract, cTokenAContract } = await loadFixture(deployOneYearLockFixture);
    
      await tokenAContract.approve(compoundLendingAdapter.address, (100 * Math.pow(10, 18)).toString());
      await compoundLendingAdapter.addCollateral(100n * decimalsBigInt);

      await compoundLendingAdapter.borrow(400n * decimalsBigInt)

      let [, liquidity, shortfall] = await comptrollerContract.getAccountLiquidity(compoundLendingAdapter.address);
      console.log(`liquidity: $ ${liquidity / Math.pow(10, 18)}`)
      console.log(`shortfall: $ ${shortfall / Math.pow(10, 18)}`)

      await mineUpTo(await time.latestBlock() + 19000000)
      await cTokenBContract.accrueInterest();

      [, liquidity, shortfall] = await comptrollerContract.getAccountLiquidity(compoundLendingAdapter.address);
      console.log(`liquidity: $ ${liquidity / Math.pow(10, 18)}`)
      console.log(`shortfall: $ ${shortfall / Math.pow(10, 18)}`)

      await tokenBContract.connect(otherAccount).approve(compoundLendingAdapter.address, 100n * decimalsBigInt);
      await compoundLendingAdapter.connect(otherAccount).liquidate(compoundLendingAdapter.address, 100n * decimalsBigInt);
      await cTokenBContract.accrueInterest();

      [, liquidity, shortfall] = await comptrollerContract.getAccountLiquidity(compoundLendingAdapter.address);
      console.log(`liquidityLast: $ ${liquidity / Math.pow(10, 18)}`)
      console.log(`shortfallLast: $ ${shortfall / Math.pow(10, 18)}`)

      expect(liquidity).to.above(0);
      expect(shortfall).to.eq(0);

     
    });

  });
});

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";
import "./interfaces/ILendingAdapter.sol";
import "./interfaces/CErc20.sol";
import "./interfaces/IComptroller.sol";

contract CompoundLendingAdapter is ILendingAdapter {
    using SafeERC20 for IERC20;
    event Log(string message);
    event LogBytes(bytes data);
    CErc20 public cTokenA;
    CErc20 public cTokenB;
    IERC20 public tokenA; // collateral token
    IERC20 public tokenB; // debt token
    IComptroller public comptroller;

    constructor(
        IComptroller _comptroller,
        CErc20 _cTokenA,
        CErc20 _cTokenB
    ) {
        cTokenA = _cTokenA;
        cTokenB = _cTokenB;
        tokenA = IERC20(cTokenA.underlying());
        tokenB = IERC20(cTokenB.underlying());
        comptroller = _comptroller;
        address[] memory cTokens = new address[](2);
        cTokens[0] = address(cTokenA);
        comptroller.enterMarkets(cTokens);
    }

    function addCollateral(uint256 amount) external {
        tokenA.safeTransferFrom(msg.sender, address(this), amount);
        tokenA.approve(address(cTokenA), amount);
        cTokenA.mint(amount);
    }

    function withdrawCollateral(uint256 amount) external {
        cTokenA.redeemUnderlying(amount);
        tokenA.transfer(msg.sender, tokenA.balanceOf(address(this)));
    }

    function borrow(uint256 amount) external {
        cTokenB.borrow(amount);
        tokenB.transfer(msg.sender, tokenB.balanceOf(address(this)));
    }

    function repayBorrow(uint256 amount) external {
        tokenB.transferFrom(msg.sender, address(this), amount);
        tokenB.approve(address(cTokenB), amount);
        cTokenB.repayBorrow(amount);
        tokenB.transfer(msg.sender, tokenB.balanceOf(address(this)));
    }

    function liquidate(address borrower, uint256 repayAmount) external {
        tokenB.transferFrom(msg.sender, address(this), repayAmount);
        uint256 balanceBefore = cTokenA.balanceOf(address(this));
        tokenB.approve(address(cTokenB), repayAmount);
        try cTokenB.liquidateBorrow(borrower, repayAmount, address(cTokenA))  {
            emit Log('works');
        } catch {
            emit Log("external call failed");
        }
        uint256 balanceAfter = cTokenA.balanceOf(address(this));
        cTokenA.redeem(balanceAfter - balanceBefore);
        tokenB.transfer(msg.sender, tokenB.balanceOf(address(this)));
        tokenA.transfer(msg.sender, tokenA.balanceOf(address(this)));
    }
}

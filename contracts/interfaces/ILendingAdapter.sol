// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

interface ILendingAdapter {
    function addCollateral(uint256 amount) external;
    function withdrawCollateral(uint256 amount) external;
    function borrow(uint256 amount) external;
    function repayBorrow(uint256 amount) external;
    function liquidate(address borrower, uint256 repayAmount) external;
}
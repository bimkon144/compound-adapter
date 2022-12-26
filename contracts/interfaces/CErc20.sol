// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface CErc20 {
    function mint(uint256) external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function supplyRatePerBlock() external returns (uint256);

    function redeem(uint) external returns (uint);

    function redeemUnderlying(uint) external returns (uint);
    
    function balanceOfUnderlying(address owner) external returns (uint);

    function balanceOf(address account) external view returns (uint);

    function underlying() external returns (address);

    function borrow(uint borrowAmount) external returns (uint);

    function repayBorrow(uint repayAmount) external returns (uint);

    function liquidateBorrow(address borrower, uint256 repayAmount, address cTokenCollateral)  external returns (uint);

}
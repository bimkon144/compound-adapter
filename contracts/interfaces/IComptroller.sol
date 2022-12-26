// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;
import "../interfaces/CErc20.sol";

interface IComptroller {
    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory);
    function checkMembership(address account, CErc20 cToken) external view returns (bool);
    function getAccountLiquidity(address account) external returns (uint, uint, uint);
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ENGN (eNGN)
 * @notice A Naira-pegged ERC20 utility token used as the settlement currency
 *         for the EProcurementPro system, localising the Euro-pegged token
 *         model proposed in the Enterprise Blockchain Design Framework
 *         (Nodehi et al., 2022) to the Nigerian fiscal environment.
 *
 *         1 eNGN represents 1 Nigerian Naira for the purposes of this
 *         prototype. In a production system this contract would be backed
 *         1:1 by a regulated reserve (e.g. issued/redeemed by the CBN or a
 *         licensed payment provider) — that reserve/oracle logic is outside
 *         the scope of this academic prototype, which focuses on the
 *         on-chain settlement mechanics.
 */
contract ENGN is ERC20, Ownable {
    /// @notice Emitted whenever the BPP mints new eNGN into circulation
    event TreasuryMinted(address indexed to, uint256 amount);

    constructor(address initialOwner)
        ERC20("eNaira Procurement Token", "eNGN")
        Ownable(initialOwner)
    {
        // Seed the deployer (Bureau of Public Procurement) with a starting
        // treasury balance so it can allocate budgets to MDAs during testing.
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
        emit TreasuryMinted(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Mint additional eNGN. Restricted to the BPP (contract owner),
     *         simulating a controlled treasury issuance process. Used in
     *         this prototype to fund MDA wallets so they can escrow tender
     *         budgets on-chain.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TreasuryMinted(to, amount);
    }
}

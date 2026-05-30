// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title HookMiner
/// @notice Minimal CREATE2 salt miner for v4 hook addresses. v4 requires the hook's *address* to
///         encode its permission bitmask in its low 14 bits; this loops salts until it finds one
///         that produces a matching address from the canonical deterministic-deployer factory.
/// @dev Vendored to avoid pulling v4-periphery (whose pinned checkout breaks our build). Same algo
///      Uniswap uses; the deployer address is the well-known `0x4e59...` CREATE2 factory that
///      Foundry pre-deploys in tests and scripts.
library HookMiner {
    /// @dev Foundry / canonical deterministic CREATE2 deployer address.
    address internal constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    /// @dev Low 14 bits of a v4 hook address encode its permission flags.
    uint160 internal constant FLAGS_MASK = (uint160(1) << 14) - 1;
    /// @dev Safety bound. Realistically a salt is found in a few thousand iterations.
    uint256 internal constant MAX_ITERATIONS = 200_000;

    error AddressNotFound(uint160 flags);
    error Create2Failed();
    error AddressMismatch(address mined, address deployed);

    /// @notice Find a salt whose CREATE2 address encodes exactly `flags` in its low 14 bits.
    /// @param flags The required permission bitmask (e.g. `BEFORE_SWAP_FLAG | ...`).
    /// @param creationCode `type(Hook).creationCode` concatenated with `abi.encode(args...)`.
    /// @return hookAddress The mined deterministic address.
    /// @return salt The salt to use with {deploy}.
    function find(uint160 flags, bytes memory creationCode) internal pure returns (address hookAddress, bytes32 salt) {
        bytes32 initCodeHash = keccak256(creationCode);
        for (uint256 i; i < MAX_ITERATIONS; i++) {
            salt = bytes32(i);
            hookAddress = _computeAddress(salt, initCodeHash);
            if (uint160(hookAddress) & FLAGS_MASK == flags) return (hookAddress, salt);
        }
        revert AddressNotFound(flags);
    }

    /// @notice Deploy through the canonical CREATE2 factory at {CREATE2_FACTORY}. Identical semantics
    ///         in a Foundry broadcast and a Foundry test (Foundry pre-deploys the factory in both),
    ///         so the mined address matches the deployed address regardless of context.
    function deploy(bytes32 salt, bytes memory creationCode) internal returns (address deployed) {
        (bool ok,) = CREATE2_FACTORY.call(abi.encodePacked(salt, creationCode));
        if (!ok) revert Create2Failed();
        deployed = _computeAddress(salt, keccak256(creationCode));
    }

    function _computeAddress(bytes32 salt, bytes32 initCodeHash) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_FACTORY, salt, initCodeHash)))));
    }
}

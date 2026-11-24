// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title AsgardVault
/// @notice On-chain registry of IPFS content owned by a wallet, plus owner-controlled access grants.
/// @dev The chain is the source of truth for ownership and grants. Rich metadata (titles, tags,
///      albums) lives off-chain in the API's database, rebuilt from the events below.
///
///      Storage layout: a CID is stored as its 32-byte sha2-256 digest plus its multicodec
///      (0x55 raw, 0x70 dag-pb). The full CIDv1 is reconstructed off-chain. This packs a file
///      into exactly 2 storage slots instead of 4+ for a CID/URL string.
///
///      NOTE: `getFiles`' access check is advisory. Anyone can call a view function with an
///      arbitrary `from`, and all storage is publicly readable. Confidentiality comes from
///      client-side encryption, not from this check.
contract AsgardVault {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct File {
        bytes32 digest; // slot 0: sha2-256 multihash digest of the CID
        uint64 addedAt; // slot 1 (packed)
        uint64 codec; //   slot 1 (packed): multicodec of the CID
        bool encrypted; // slot 1 (packed)
        bool removed; //   slot 1 (packed)
    }

    uint256 public constant MAX_BATCH = 50;

    mapping(address owner => File[]) private _files;
    mapping(address owner => EnumerableSet.AddressSet) private _viewers;

    event FileAdded(
        address indexed owner,
        uint256 indexed fileId,
        bytes32 digest,
        uint64 codec,
        bool encrypted
    );
    event FileRemoved(address indexed owner, uint256 indexed fileId);
    event AccessGranted(address indexed owner, address indexed viewer);
    event AccessRevoked(address indexed owner, address indexed viewer);

    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 max);
    error LengthMismatch();
    error EmptyDigest();
    error InvalidViewer();
    error AlreadyGranted();
    error NotGranted();
    error FileNotFound(uint256 fileId);
    error NotAuthorized();

    // ---------------------------------------------------------------- writes

    /// @notice Register a single file for the caller.
    function addFile(bytes32 digest, uint64 codec, bool encrypted) external {
        _add(msg.sender, digest, codec, encrypted);
    }

    /// @notice Register many files for the caller in one transaction (amortises the 21k base cost).
    function addFiles(
        bytes32[] calldata digests,
        uint64[] calldata codecs,
        bool[] calldata encrypted
    ) external {
        uint256 n = digests.length;
        if (n == 0) revert EmptyBatch();
        if (n > MAX_BATCH) revert BatchTooLarge(n, MAX_BATCH);
        if (n != codecs.length || n != encrypted.length) revert LengthMismatch();
        for (uint256 i; i < n; ) {
            _add(msg.sender, digests[i], codecs[i], encrypted[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Soft-delete one of the caller's files. IDs stay stable.
    function removeFile(uint256 fileId) external {
        File[] storage files = _files[msg.sender];
        if (fileId >= files.length || files[fileId].removed) revert FileNotFound(fileId);
        files[fileId].removed = true;
        emit FileRemoved(msg.sender, fileId);
    }

    function grantAccess(address viewer) external {
        if (viewer == address(0) || viewer == msg.sender) revert InvalidViewer();
        if (!_viewers[msg.sender].add(viewer)) revert AlreadyGranted();
        emit AccessGranted(msg.sender, viewer);
    }

    function revokeAccess(address viewer) external {
        if (!_viewers[msg.sender].remove(viewer)) revert NotGranted();
        emit AccessRevoked(msg.sender, viewer);
    }

    // ----------------------------------------------------------------- reads

    function hasAccess(address owner, address viewer) public view returns (bool) {
        return owner == viewer || _viewers[owner].contains(viewer);
    }

    /// @notice All files of `owner` (soft-deleted ones are flagged). Advisory access check.
    function getFiles(address owner) external view returns (File[] memory) {
        if (!hasAccess(owner, msg.sender)) revert NotAuthorized();
        return _files[owner];
    }

    function fileCount(address owner) external view returns (uint256) {
        return _files[owner].length;
    }

    function viewersOf(address owner) external view returns (address[] memory) {
        return _viewers[owner].values();
    }

    // -------------------------------------------------------------- internal

    function _add(address owner, bytes32 digest, uint64 codec, bool encrypted) private {
        if (digest == bytes32(0)) revert EmptyDigest();
        uint256 id = _files[owner].length;
        _files[owner].push(
            File({
                digest: digest,
                addedAt: uint64(block.timestamp),
                codec: codec,
                encrypted: encrypted,
                removed: false
            })
        );
        emit FileAdded(owner, id, digest, codec, encrypted);
    }
}

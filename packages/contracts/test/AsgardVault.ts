import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import hre from "hardhat";
import { getAddress, keccak256, toHex, zeroAddress, zeroHash } from "viem";

chai.use(chaiAsPromised);

// Any 32-byte value works as a sha2-256 digest for contract-level tests.
const DIGEST_A = keccak256(toHex("file-a"));
const DIGEST_B = keccak256(toHex("file-b"));
const RAW = 0x55n;
const DAG_PB = 0x70n;

async function deployFixture() {
  const [owner, viewer, stranger] = await hre.viem.getWalletClients();
  const vault = await hre.viem.deployContract("AsgardVault");
  const asViewer = await hre.viem.getContractAt("AsgardVault", vault.address, {
    client: { wallet: viewer },
  });
  const asStranger = await hre.viem.getContractAt("AsgardVault", vault.address, {
    client: { wallet: stranger },
  });
  return { vault, asViewer, asStranger, owner, viewer, stranger };
}

describe("AsgardVault", () => {
  describe("adding files", () => {
    it("stores files under msg.sender only (fixes v1 add(_user) hole)", async () => {
      const { vault, asStranger, owner, stranger } = await loadFixture(deployFixture);
      await asStranger.write.addFile([DIGEST_A, RAW, false]);

      expect(await vault.read.fileCount([owner.account.address])).to.equal(0n);
      expect(await vault.read.fileCount([stranger.account.address])).to.equal(1n);
    });

    it("emits FileAdded with sequential ids and packed fields", async () => {
      const { vault, owner } = await loadFixture(deployFixture);
      await vault.write.addFiles([[DIGEST_A, DIGEST_B], [RAW, DAG_PB], [true, false]]);

      const events = await vault.getEvents.FileAdded({}, { fromBlock: 0n });
      expect(events).to.have.length(2);
      expect(events[0].args.owner).to.equal(getAddress(owner.account.address));
      expect(events[0].args.fileId).to.equal(0n);
      expect(events[0].args.encrypted).to.equal(true);
      expect(events[1].args.fileId).to.equal(1n);
      expect(events[1].args.digest).to.equal(DIGEST_B);
      expect(events[1].args.codec).to.equal(DAG_PB);

      const files = await vault.read.getFiles([owner.account.address], {
        account: owner.account,
      });
      expect(files[0].digest).to.equal(DIGEST_A);
      expect(files[0].codec).to.equal(RAW);
      expect(files[0].addedAt > 0n).to.equal(true);
    });

    it("rejects empty, oversized, mismatched batches and zero digests", async () => {
      const { vault } = await loadFixture(deployFixture);
      await expect(vault.write.addFiles([[], [], []])).to.be.rejectedWith("EmptyBatch");
      await expect(vault.write.addFiles([[DIGEST_A], [RAW], [true, false]])).to.be.rejectedWith(
        "LengthMismatch",
      );
      await expect(vault.write.addFiles([[DIGEST_A], [RAW, RAW], [true]])).to.be.rejectedWith(
        "LengthMismatch",
      );
      const n = 51;
      await expect(
        vault.write.addFiles([Array(n).fill(DIGEST_A), Array(n).fill(RAW), Array(n).fill(false)]),
      ).to.be.rejectedWith("BatchTooLarge");
      await expect(vault.write.addFile([zeroHash, RAW, false])).to.be.rejectedWith("EmptyDigest");
    });

    it("soft-deletes files and keeps ids stable", async () => {
      const { vault, owner } = await loadFixture(deployFixture);
      await vault.write.addFiles([[DIGEST_A, DIGEST_B], [RAW, RAW], [false, false]]);
      await vault.write.removeFile([0n]);

      const files = await vault.read.getFiles([owner.account.address], {
        account: owner.account,
      });
      expect(files[0].removed).to.equal(true);
      expect(files[1].removed).to.equal(false);
      expect(await vault.getEvents.FileRemoved({}, { fromBlock: 0n })).to.have.length(1);
      await expect(vault.write.removeFile([0n])).to.be.rejectedWith("FileNotFound");
      await expect(vault.write.removeFile([9n])).to.be.rejectedWith("FileNotFound");
    });
  });

  describe("access control", () => {
    it("blocks reads without a grant", async () => {
      const { vault, asStranger, owner, stranger } = await loadFixture(deployFixture);
      await vault.write.addFile([DIGEST_A, RAW, true]);
      await expect(
        asStranger.read.getFiles([owner.account.address], { account: stranger.account }),
      ).to.be.rejectedWith("NotAuthorized");
    });

    it("grant -> read -> revoke -> denied", async () => {
      const { vault, asViewer, owner, viewer } = await loadFixture(deployFixture);
      await vault.write.addFile([DIGEST_A, RAW, true]);

      await vault.write.grantAccess([viewer.account.address]);
      expect(await vault.read.hasAccess([owner.account.address, viewer.account.address])).to.equal(
        true,
      );
      const files = await asViewer.read.getFiles([owner.account.address], {
        account: viewer.account,
      });
      expect(files[0].digest).to.equal(DIGEST_A);
      expect(await vault.read.viewersOf([owner.account.address])).to.deep.equal([
        getAddress(viewer.account.address),
      ]);

      await vault.write.revokeAccess([viewer.account.address]);
      await expect(
        asViewer.read.getFiles([owner.account.address], { account: viewer.account }),
      ).to.be.rejectedWith("NotAuthorized");
      expect(await vault.read.viewersOf([owner.account.address])).to.deep.equal([]);
    });

    it("re-granting after revoke does not duplicate viewers (v1 previousData hack removed)", async () => {
      const { vault, owner, viewer } = await loadFixture(deployFixture);
      await vault.write.grantAccess([viewer.account.address]);
      await vault.write.revokeAccess([viewer.account.address]);
      await vault.write.grantAccess([viewer.account.address]);
      expect(await vault.read.viewersOf([owner.account.address])).to.have.length(1);
    });

    it("emits grant/revoke events and validates inputs", async () => {
      const { vault, owner, viewer } = await loadFixture(deployFixture);
      await vault.write.grantAccess([viewer.account.address]);
      await vault.write.revokeAccess([viewer.account.address]);
      expect(await vault.getEvents.AccessGranted({}, { fromBlock: 0n })).to.have.length(1);
      expect(await vault.getEvents.AccessRevoked({}, { fromBlock: 0n })).to.have.length(1);

      await expect(vault.write.grantAccess([zeroAddress])).to.be.rejectedWith("InvalidViewer");
      await expect(vault.write.grantAccess([owner.account.address])).to.be.rejectedWith(
        "InvalidViewer",
      );
      await vault.write.grantAccess([viewer.account.address]);
      await expect(vault.write.grantAccess([viewer.account.address])).to.be.rejectedWith(
        "AlreadyGranted",
      );
      await vault.write.revokeAccess([viewer.account.address]);
      await expect(vault.write.revokeAccess([viewer.account.address])).to.be.rejectedWith(
        "NotGranted",
      );
    });
  });
});

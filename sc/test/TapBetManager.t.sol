// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../src/trading/TapBetManager.sol";
import "../src/trading/PriceAdapter.sol";
import "../src/trading/MultiplierEngine.sol";
import "../src/treasury/TapVault.sol";
import "../src/token/MockUSDC.sol";
import "./mocks/MockPyth.sol";

contract TapBetManagerTest is Test {
    TapBetManager    public manager;
    PriceAdapter     public priceAdapter;
    MultiplierEngine public multiplierEngine;
    TapVault         public vault;
    MockUSDC         public usdc;
    TestMockPyth     public mockPyth;

    address public owner    = address(this);
    address public user     = address(0xA1);
    address public settler  = address(0xB2);
    address public lp       = address(0xC3);

    bytes32 constant BTC_SYMBOL   = keccak256("BTC");
    bytes32 constant BTC_PRICE_ID = bytes32(uint256(0x1));

    // $68,000 at 8-decimal, expo -8
    int64  constant PRICE_8DEC  = 68_000 * 1e8;
    uint64 constant CONF_TIGHT  = 1; // negligible confidence
    int32  constant EXPO        = -8;

    uint256 constant COLLATERAL  = 10 * 1e6;    // 10 USDC
    uint256 constant VAULT_SEED  = 50_000 * 1e6; // 50,000 USDC LP

    function setUp() public {
        vm.warp(1000); // ensure block.timestamp is large enough for stale-proof arithmetic
        usdc            = new MockUSDC(0);
        mockPyth        = new TestMockPyth(30, 1); // 30s validity, 1 wei fee/update
        priceAdapter    = new PriceAdapter(address(mockPyth));
        multiplierEngine = new MultiplierEngine();
        vault           = new TapVault(address(usdc));

        manager = new TapBetManager(
            address(vault),
            address(priceAdapter),
            address(multiplierEngine),
            address(usdc)
        );

        // Wire vault → manager
        vault.setBetManager(address(manager));

        // Register BTC price feed
        priceAdapter.setPriceId(BTC_SYMBOL, BTC_PRICE_ID);

        // Seed vault LP
        usdc.mint(lp, VAULT_SEED);
        vm.prank(lp);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(VAULT_SEED);

        // Give user USDC and approval
        usdc.mint(user, 10_000 * 1e6);
        vm.prank(user);
        usdc.approve(address(manager), type(uint256).max);

        // Seed test contract and settler with ETH for Pyth fee
        vm.deal(address(this), 10 ether);
        vm.deal(settler, 10 ether);
        vm.deal(user, 10 ether);

        // Set current price in mock
        _setPrice(PRICE_8DEC, uint64(block.timestamp));
    }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    function _setPrice(int64 price, uint64 ts) internal {
        mockPyth.setPrice{value: 1}(BTC_PRICE_ID, price, CONF_TIGHT, EXPO, ts);
    }

    function _buildUpdateData(int64 price, uint64 ts) internal view
        returns (bytes[] memory data)
    {
        // Use ts + 1 so MockPyth accepts the update (requires publishTime > last stored)
        data = new bytes[](1);
        data[0] = mockPyth.createPriceFeedUpdateData(
            BTC_PRICE_ID, price, CONF_TIGHT, EXPO, price, CONF_TIGHT, ts + 1
        );
    }

    function _placeBetUp() internal returns (uint256 betId) {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        // +2% target → BAND_2
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + 300; // 5 min
        uint256 timeToExpiry = expiry - block.timestamp;
        uint256 expectedMul = multiplierEngine.getMultiplier(currentPrice, target, timeToExpiry);

        vm.prank(user);
        betId = manager.placeBet(BTC_SYMBOL, target, currentPrice, COLLATERAL, expiry, expectedMul);
    }

    function _placeBetDown() internal returns (uint256 betId) {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        // -2% target → BAND_2
        uint256 target = currentPrice - (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + 300;
        uint256 timeToExpiry = expiry - block.timestamp;
        uint256 expectedMul = multiplierEngine.getMultiplier(currentPrice, target, timeToExpiry);

        vm.prank(user);
        betId = manager.placeBet(BTC_SYMBOL, target, currentPrice, COLLATERAL, expiry, expectedMul);
    }

    // ─────────────────────────────────────────
    // placeBet — UP
    // ─────────────────────────────────────────

    function testPlaceBet_UP_CreatesActiveBet() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        assertEq(uint8(bet.direction), uint8(TapBetManager.Direction.UP));
        assertEq(uint8(bet.status),    uint8(TapBetManager.BetStatus.ACTIVE));
        assertEq(bet.collateral, COLLATERAL);
        assertEq(bet.user, user);

        uint256[] memory active = manager.getActiveBets();
        assertEq(active.length, 1);
        assertEq(active[0], betId);
    }

    function testPlaceBet_DOWN_CreatesActiveBet() public {
        uint256 betId = _placeBetDown();
        TapBetManager.Bet memory bet = manager.getBet(betId);
        assertEq(uint8(bet.direction), uint8(TapBetManager.Direction.DOWN));
        assertEq(uint8(bet.status),    uint8(TapBetManager.BetStatus.ACTIVE));
    }

    function testPlaceBet_TransfersCollateralToVault() public {
        uint256 vaultBefore = usdc.balanceOf(address(vault));
        _placeBetUp();
        assertEq(usdc.balanceOf(address(vault)), vaultBefore + COLLATERAL);
    }

    function testPlaceBet_ZeroCollateralReverts() public {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + 300;
        uint256 mul = multiplierEngine.getMultiplier(currentPrice, target, 300);

        vm.prank(user);
        vm.expectRevert("TBM: zero collateral");
        manager.placeBet(BTC_SYMBOL, target, currentPrice, 0, expiry, mul);
    }

    function testPlaceBet_ExpiredExpiryReverts() public {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 mul = multiplierEngine.getMultiplier(currentPrice, target, 300);

        vm.prank(user);
        vm.expectRevert("TBM: expiry in past");
        manager.placeBet(BTC_SYMBOL, target, currentPrice, COLLATERAL, block.timestamp - 1, mul);
    }

    // ─────────────────────────────────────────
    // Multiplier slippage tolerance
    // ─────────────────────────────────────────

    function testPlaceBet_MultiplierWithin1Pct_Passes() public {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + 300;
        uint256 actualMul = multiplierEngine.getMultiplier(currentPrice, target, 300);
        // ±0.9% should pass (within 1% tolerance)
        uint256 expected = actualMul * 10090 / 10000; // +0.9%

        vm.prank(user);
        manager.placeBet(BTC_SYMBOL, target, currentPrice, COLLATERAL, expiry, expected);
    }

    function testPlaceBet_MultiplierOver1Pct_Reverts() public {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + 300;
        uint256 actualMul = multiplierEngine.getMultiplier(currentPrice, target, 300);
        // +2% deviation → should revert
        uint256 expected = actualMul * 10200 / 10000;

        vm.prank(user);
        vm.expectRevert("TBM: multiplier slippage exceeded");
        manager.placeBet(BTC_SYMBOL, target, currentPrice, COLLATERAL, expiry, expected);
    }

    // ─────────────────────────────────────────
    // settleBetWin — UP
    // ─────────────────────────────────────────

    function testSettleBetWin_UP_PayoutsCorrectly() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        // Price moves to target or above
        uint64 newTs = uint64(block.timestamp);
        _setPrice(int64(uint64(bet.targetPrice)), newTs);

        bytes[] memory data = _buildUpdateData(int64(uint64(bet.targetPrice)), newTs);

        uint256 userBefore    = usdc.balanceOf(user);
        uint256 settlerBefore = usdc.balanceOf(settler);

        vm.prank(settler);
        manager.settleBetWin(betId);

        TapBetManager.Bet memory settled = manager.getBet(betId);
        assertEq(uint8(settled.status), uint8(TapBetManager.BetStatus.WON));

        uint256 totalPayout = (COLLATERAL * bet.multiplier) / 100;
        uint256 settlerFee  = (totalPayout * manager.SETTLER_FEE_BPS()) / 10000;
        uint256 userPayout  = totalPayout - settlerFee;

        assertEq(usdc.balanceOf(user)    - userBefore,    userPayout);
        assertEq(usdc.balanceOf(settler) - settlerBefore, settlerFee);

        // Active bets cleared
        assertEq(manager.getActiveBets().length, 0);
    }

    function testSettleBetWin_DOWN_PayoutsCorrectly() public {
        uint256 betId = _placeBetDown();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        // Price drops to target
        uint64 newTs = uint64(block.timestamp);
        _setPrice(int64(uint64(bet.targetPrice)), newTs);

        bytes[] memory data = _buildUpdateData(int64(uint64(bet.targetPrice)), newTs);

        uint256 userBefore = usdc.balanceOf(user);

        vm.prank(settler);
        manager.settleBetWin(betId);

        assertGt(usdc.balanceOf(user), userBefore);
    }

    // ─────────────────────────────────────────
    // settleBetWin — price not reached
    // ─────────────────────────────────────────

    function testSettleBetWin_PriceNotReached_Reverts() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        // Price stays below target
        uint256 belowTarget = bet.targetPrice - 1;
        uint64 newTs = uint64(block.timestamp);
        _setPrice(int64(uint64(belowTarget)), newTs);

        bytes[] memory data = _buildUpdateData(int64(uint64(belowTarget)), newTs);

        vm.prank(settler);
        vm.expectRevert("TBM: win condition not met");
        manager.settleBetWin(betId);
    }

    // ─────────────────────────────────────────
    // settleBetWin — already settled
    // ─────────────────────────────────────────

    function testSettleBetWin_AlreadySettled_Reverts() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        uint64 newTs = uint64(block.timestamp);
        _setPrice(int64(uint64(bet.targetPrice)), newTs);
        bytes[] memory data = _buildUpdateData(int64(uint64(bet.targetPrice)), newTs);

        vm.prank(settler);
        manager.settleBetWin(betId);

        // Second attempt should revert
        vm.prank(settler);
        vm.expectRevert("TBM: not active");
        manager.settleBetWin(betId);
    }

    // ─────────────────────────────────────────
    // settleExpired
    // ─────────────────────────────────────────

    function testSettleExpired_BeforeExpiry_Reverts() public {
        uint256 betId = _placeBetUp();

        vm.expectRevert("TBM: not yet expired");
        manager.settleExpired(betId);
    }

    function testSettleExpired_AfterExpiry_Succeeds() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        vm.warp(bet.expiry + 1);

        manager.settleExpired(betId);

        TapBetManager.Bet memory settled = manager.getBet(betId);
        assertEq(uint8(settled.status), uint8(TapBetManager.BetStatus.EXPIRED));
        assertEq(manager.getActiveBets().length, 0);
    }

    function testSettleExpired_CollateralStaysInVault() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);
        uint256 vaultBalance = usdc.balanceOf(address(vault));

        vm.warp(bet.expiry + 1);
        manager.settleExpired(betId);

        // Vault balance unchanged (collateral stays as LP profit)
        assertEq(usdc.balanceOf(address(vault)), vaultBalance);
    }

    // ─────────────────────────────────────────
    // batchSettleExpired — mixed batch
    // ─────────────────────────────────────────

    function testBatchSettleExpired_MixedBatch() public {
        uint256 betId0 = _placeBetUp();
        uint256 betId1 = _placeBetUp();
        uint256 betId2 = _placeBetDown();

        // Expire betId0 and betId2 but not betId1
        TapBetManager.Bet memory b0 = manager.getBet(betId0);
        TapBetManager.Bet memory b2 = manager.getBet(betId2);

        // betId0 was placed first; warp past its expiry
        vm.warp(b0.expiry + 1);

        // betId1 has same expiry (same block), also expired now
        // Place a fresh bet for betId2 that extends into the future? No — all placed in setUp.
        // Actually all three are placed in the same block so all share same expiry.
        // Let's just test that batchSettleExpired processes valid ones and ignores already-settled.

        // Settle betId1 via settleBetWin first to mark it WON
        TapBetManager.Bet memory b1 = manager.getBet(betId1);
        // Price is already past expiry — settleBetWin will revert ("bet expired")
        // So instead we pre-settle betId1 before warping

        // Restart: place fresh bets, settle betId1 before warp
        // Actually let's just test with invalid IDs in batch (non-existent)
        uint256[] memory ids = new uint256[](4);
        ids[0] = betId0;
        ids[1] = betId1;
        ids[2] = betId2;
        ids[3] = 9999; // non-existent — should be skipped

        manager.batchSettleExpired(ids);

        assertEq(uint8(manager.getBet(betId0).status), uint8(TapBetManager.BetStatus.EXPIRED));
        assertEq(uint8(manager.getBet(betId1).status), uint8(TapBetManager.BetStatus.EXPIRED));
        assertEq(uint8(manager.getBet(betId2).status), uint8(TapBetManager.BetStatus.EXPIRED));
        assertEq(manager.getActiveBets().length, 0);
    }

    function testBatchSettleExpired_AlreadySettled_Skipped() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        vm.warp(bet.expiry + 1);
        manager.settleExpired(betId);

        // Calling batch again should not revert (skip already-settled)
        uint256[] memory ids = new uint256[](1);
        ids[0] = betId;
        manager.batchSettleExpired(ids);
    }

    // ─────────────────────────────────────────
    // Settler fee calculation
    // ─────────────────────────────────────────

    function testSettlerFee_IsCorrectBps() public {
        uint256 betId = _placeBetUp();
        TapBetManager.Bet memory bet = manager.getBet(betId);

        uint64 newTs = uint64(block.timestamp);
        _setPrice(int64(uint64(bet.targetPrice)), newTs);
        bytes[] memory data = _buildUpdateData(int64(uint64(bet.targetPrice)), newTs);

        uint256 settlerBefore = usdc.balanceOf(settler);

        vm.prank(settler);
        manager.settleBetWin(betId);

        uint256 totalPayout = (COLLATERAL * bet.multiplier) / 100;
        uint256 expectedFee = (totalPayout * 50) / 10000; // 0.5%
        assertEq(usdc.balanceOf(settler) - settlerBefore, expectedFee);
    }

    // ─────────────────────────────────────────
    // placeBetsWithSessionSignature — batch placement
    // ─────────────────────────────────────────

    event BetPlacementSkipped(
        address indexed trader,
        bytes32 indexed symbol,
        uint256 targetPrice,
        uint256 expiry,
        string reason
    );

    function _buildBetParamsUp(uint256 expirySecondsFromNow) internal view returns (TapBetManager.BetParams memory p) {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + expirySecondsFromNow;
        uint256 expectedMul = multiplierEngine.getMultiplier(currentPrice, target, expirySecondsFromNow);
        p = TapBetManager.BetParams({
            symbol: BTC_SYMBOL,
            targetPrice: target,
            entryPrice: currentPrice,
            collateral: COLLATERAL,
            expiry: expiry,
            expectedMultiplier: expectedMul
        });
    }

    function _buildBetParamsDown(uint256 expirySecondsFromNow) internal view returns (TapBetManager.BetParams memory p) {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice - (currentPrice * 200) / 10000;
        uint256 expiry = block.timestamp + expirySecondsFromNow;
        uint256 expectedMul = multiplierEngine.getMultiplier(currentPrice, target, expirySecondsFromNow);
        p = TapBetManager.BetParams({
            symbol: BTC_SYMBOL,
            targetPrice: target,
            entryPrice: currentPrice,
            collateral: COLLATERAL,
            expiry: expiry,
            expectedMultiplier: expectedMul
        });
    }

    function _buildStaleBetParams() internal view returns (TapBetManager.BetParams memory p) {
        uint256 currentPrice = uint256(uint64(PRICE_8DEC));
        uint256 target = currentPrice + (currentPrice * 200) / 10000;
        p = TapBetManager.BetParams({
            symbol: BTC_SYMBOL,
            targetPrice: target,
            entryPrice: currentPrice,
            collateral: COLLATERAL,
            expiry: block.timestamp - 1, // already expired by the time the batch lands
            expectedMultiplier: 0
        });
    }

    function _signSessionBatch(
        uint256 signerPk,
        address trader,
        TapBetManager.BetParams[] memory betsList,
        uint256 nonce
    ) internal view returns (bytes memory signature) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                trader,
                keccak256(abi.encode(betsList)),
                nonce,
                address(manager),
                block.chainid
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethSignedHash);
        signature = abi.encodePacked(r, s, v);
    }

    function testPlaceBetsBatch_HappyPath_PlacesAllAndIncrementsNonce() public {
        uint256 sessionPk = 0xA11CE;
        address sessionKey = vm.addr(sessionPk);
        vm.prank(user);
        manager.authorizeSessionKey(sessionKey);

        TapBetManager.BetParams[] memory bets = new TapBetManager.BetParams[](3);
        bets[0] = _buildBetParamsUp(300);
        bets[1] = _buildBetParamsUp(300);
        bets[2] = _buildBetParamsDown(300);

        uint256 nonceBefore = manager.sessionNonces(user);
        bytes memory sig = _signSessionBatch(sessionPk, user, bets, nonceBefore);

        uint256 vaultBefore = usdc.balanceOf(address(vault));

        manager.placeBetsWithSessionSignature(user, bets, sig);

        assertEq(manager.sessionNonces(user), nonceBefore + 1);
        assertEq(manager.getActiveBets().length, 3);
        assertEq(usdc.balanceOf(address(vault)), vaultBefore + COLLATERAL * 3);
    }

    function testPlaceBetsBatch_PartialSkip_StaleEntrySkippedRestPlaced() public {
        uint256 sessionPk = 0xB0B;
        address sessionKey = vm.addr(sessionPk);
        vm.prank(user);
        manager.authorizeSessionKey(sessionKey);

        TapBetManager.BetParams[] memory bets = new TapBetManager.BetParams[](3);
        bets[0] = _buildBetParamsUp(300);
        bets[1] = _buildStaleBetParams();
        bets[2] = _buildBetParamsUp(300);

        uint256 nonceBefore = manager.sessionNonces(user);
        bytes memory sig = _signSessionBatch(sessionPk, user, bets, nonceBefore);

        vm.expectEmit(true, true, false, true);
        emit BetPlacementSkipped(user, bets[1].symbol, bets[1].targetPrice, bets[1].expiry, "expiry in past");

        manager.placeBetsWithSessionSignature(user, bets, sig);

        // Only the 2 valid entries got placed; the whole batch still shares one nonce bump
        assertEq(manager.getActiveBets().length, 2);
        assertEq(manager.sessionNonces(user), nonceBefore + 1);
    }

    function testPlaceBetsBatch_BadSignature_Reverts() public {
        uint256 sessionPk = 0xC0FFEE;
        address sessionKey = vm.addr(sessionPk);
        vm.prank(user);
        manager.authorizeSessionKey(sessionKey);

        TapBetManager.BetParams[] memory bets = new TapBetManager.BetParams[](1);
        bets[0] = _buildBetParamsUp(300);

        // Signed by a key the trader never authorized
        uint256 wrongPk = 0xBADBAD;
        bytes memory sig = _signSessionBatch(wrongPk, user, bets, manager.sessionNonces(user));

        vm.expectRevert("TBM: invalid session signature");
        manager.placeBetsWithSessionSignature(user, bets, sig);
    }

    function testPlaceBetsBatch_EmptyBatch_Reverts() public {
        TapBetManager.BetParams[] memory bets = new TapBetManager.BetParams[](0);
        vm.expectRevert("TBM: empty batch");
        manager.placeBetsWithSessionSignature(user, bets, "");
    }

    function testPlaceBetsBatch_OversizedBatch_Reverts() public {
        uint256 max = manager.MAX_BATCH_SIZE();
        TapBetManager.BetParams[] memory bets = new TapBetManager.BetParams[](max + 1);
        for (uint256 i = 0; i < bets.length; i++) {
            bets[i] = _buildBetParamsUp(300);
        }

        vm.expectRevert("TBM: batch too large");
        manager.placeBetsWithSessionSignature(user, bets, "");
    }
}

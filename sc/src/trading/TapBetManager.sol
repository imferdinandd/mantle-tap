// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITapVault {
    function collectCollateral(uint256 amount) external;
    function payout(address to, uint256 amount) external;
    function canCoverPayout(uint256 amount) external view returns (bool);
}

interface IPriceAdapter {
    function verifyAndGetPrice(bytes[] calldata priceUpdateData, bytes32 priceId)
        external payable returns (uint256 price, uint256 publishTime);
    function getLatestPrice(bytes32 priceId)
        external view returns (uint256 price, uint256 publishTime);
    function priceIds(bytes32 symbol) external view returns (bytes32);
}

interface IMultiplierEngine {
    function getMultiplier(uint256 currentPrice, uint256 targetPrice, uint256 timeToExpiry)
        external view returns (uint256);
}

/**
 * @title TapBetManager
 * @notice Core bet lifecycle: place, settle wins (permissionless), settle expired bets.
 * @dev Users approve this contract for USDC. This contract pulls from user and sends to vault.
 *      Session keys can be authorized by traders to place bets on their behalf (no popup per bet).
 */
contract TapBetManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    enum Direction { UP, DOWN }
    enum BetStatus  { ACTIVE, WON, EXPIRED }

    struct Bet {
        uint256   betId;
        address   user;
        bytes32   symbol;
        uint256   targetPrice;
        uint256   collateral;
        uint256   multiplier;
        Direction direction;
        uint256   expiry;
        BetStatus status;
        uint256   placedAt;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    mapping(uint256 => Bet)              public bets;
    mapping(address => uint256[])        public userBets;
    uint256[]                            public activeBetIds;
    uint256                              public nextBetId;

    // trader => sessionKey => authorized
    mapping(address => mapping(address => bool)) public authorizedSessionKeys;
    mapping(address => uint256) public sessionNonces;

    ITapVault         public immutable vault;
    IPriceAdapter     public immutable priceAdapter;
    IMultiplierEngine public immutable multiplierEngine;
    IERC20            public immutable usdc;

    uint256 public SETTLER_FEE_BPS = 50;
    uint256 public constant MAX_MULTIPLIER_SLIPPAGE_BPS = 100;
    address public settler;

    // ─── Events ────────────────────────────────────────────────────────────────

    event BetPlaced(
        uint256 indexed betId,
        address indexed user,
        bytes32 indexed symbol,
        uint256 targetPrice,
        uint256 collateral,
        uint256 multiplier,
        Direction direction,
        uint256 expiry
    );
    event BetWon(
        uint256 indexed betId,
        address indexed user,
        address indexed settler,
        uint256 payout,
        uint256 settlerFee
    );
    event BetExpired(uint256 indexed betId, address indexed user);
    event SettlerFeeUpdated(uint256 newFeeBps);
    event SessionKeyAuthorized(address indexed trader, address indexed sessionKey);
    event SessionKeyRevoked(address indexed trader, address indexed sessionKey);
    event SessionBetRelayed(address indexed trader, address indexed sessionKey, address indexed relayer, uint256 nonce);

    constructor(
        address _vault,
        address _priceAdapter,
        address _multiplierEngine,
        address _usdc
    ) Ownable(msg.sender) {
        require(_vault != address(0),            "TBM: zero vault");
        require(_priceAdapter != address(0),     "TBM: zero priceAdapter");
        require(_multiplierEngine != address(0), "TBM: zero multiplierEngine");
        require(_usdc != address(0),             "TBM: zero usdc");

        vault            = ITapVault(_vault);
        priceAdapter     = IPriceAdapter(_priceAdapter);
        multiplierEngine = IMultiplierEngine(_multiplierEngine);
        usdc             = IERC20(_usdc);
    }

    modifier onlySettler() {
        require(msg.sender == settler, "TBM: not settler");
        _;
    }

    // ─── Owner controls ────────────────────────────────────────────────────────

    function setSettler(address _settler) external onlyOwner {
        require(_settler != address(0), "TBM: zero settler");
        settler = _settler;
    }

    function setSettlerFeeBps(uint256 feeBps) external onlyOwner {
        require(feeBps <= 500, "TBM: fee too high");
        SETTLER_FEE_BPS = feeBps;
        emit SettlerFeeUpdated(feeBps);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Session key management ────────────────────────────────────────────────

    /**
     * @notice Authorize a session key to place bets on your behalf.
     *         You must also approve this contract to spend your USDC.
     */
    function authorizeSessionKey(address sessionKey) external {
        require(sessionKey != address(0), "TBM: zero session key");
        require(sessionKey != msg.sender, "TBM: cannot self-authorize");
        authorizedSessionKeys[msg.sender][sessionKey] = true;
        emit SessionKeyAuthorized(msg.sender, sessionKey);
    }

    /**
     * @notice Revoke a previously authorized session key.
     */
    function revokeSessionKey(address sessionKey) external {
        authorizedSessionKeys[msg.sender][sessionKey] = false;
        emit SessionKeyRevoked(msg.sender, sessionKey);
    }

    // ─── Place bet ─────────────────────────────────────────────────────────────

    /**
     * @notice Place a bet directly (msg.sender is the trader).
     */
    function placeBet(
        bytes32 symbol,
        uint256 targetPrice,
        uint256 entryPrice,
        uint256 collateral,
        uint256 expiry,
        uint256 expectedMultiplier
    ) external nonReentrant whenNotPaused returns (uint256 betId) {
        betId = _placeBetFor(msg.sender, symbol, targetPrice, entryPrice, collateral, expiry, expectedMultiplier);
    }

    /**
     * @notice Place a bet on behalf of `trader` using an authorized session key.
     *         USDC is pulled from `trader` (not msg.sender).
     *         Payout on win goes to `trader`.
     * @dev Call `authorizeSessionKey(sessionKey)` and `usdc.approve(betManager, max)` once.
     */
    function placeBetFor(
        address trader,
        bytes32 symbol,
        uint256 targetPrice,
        uint256 entryPrice,
        uint256 collateral,
        uint256 expiry,
        uint256 expectedMultiplier
    ) external nonReentrant whenNotPaused returns (uint256 betId) {
        require(authorizedSessionKeys[trader][msg.sender], "TBM: session key not authorized");
        betId = _placeBetFor(trader, symbol, targetPrice, entryPrice, collateral, expiry, expectedMultiplier);
    }

    /**
     * @notice Place a bet via backend relayer using an authorized session key signature.
     *         The session key signs off-chain; the relayer pays native gas.
     * @dev Signature is over trader, bet params, current trader nonce, this contract, and chain id.
     */
    function placeBetWithSessionSignature(
        address trader,
        bytes32 symbol,
        uint256 targetPrice,
        uint256 entryPrice,
        uint256 collateral,
        uint256 expiry,
        uint256 expectedMultiplier,
        bytes calldata signature
    ) external nonReentrant whenNotPaused returns (uint256 betId) {
        require(trader != address(0), "TBM: zero trader");

        uint256 nonce = sessionNonces[trader];
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                trader,
                symbol,
                targetPrice,
                entryPrice,
                collateral,
                expiry,
                expectedMultiplier,
                nonce,
                address(this),
                block.chainid
            )
        );

        address sessionKey = ECDSA.recover(messageHash.toEthSignedMessageHash(), signature);
        require(authorizedSessionKeys[trader][sessionKey], "TBM: invalid session signature");

        sessionNonces[trader] = nonce + 1;
        betId = _placeBetFor(trader, symbol, targetPrice, entryPrice, collateral, expiry, expectedMultiplier);

        emit SessionBetRelayed(trader, sessionKey, msg.sender, nonce);
    }

    function _placeBetFor(
        address trader,
        bytes32 symbol,
        uint256 targetPrice,
        uint256 entryPrice,
        uint256 collateral,
        uint256 expiry,
        uint256 expectedMultiplier
    ) internal returns (uint256 betId) {
        require(targetPrice > 0,                  "TBM: zero target price");
        require(entryPrice  > 0,                  "TBM: zero entry price");
        require(collateral  > 0,                  "TBM: zero collateral");
        require(expiry > block.timestamp,         "TBM: expiry in past");
        require(expiry <= block.timestamp + 3600, "TBM: expiry too far");

        uint256 actualMultiplier = _validateAndGetMultiplier(
            entryPrice, targetPrice, expiry, expectedMultiplier
        );

        betId = _storeBet(trader, symbol, targetPrice, collateral, expiry, actualMultiplier, entryPrice);

        usdc.safeTransferFrom(trader, address(vault), collateral);
        vault.collectCollateral(collateral);

        Direction direction = targetPrice >= entryPrice ? Direction.UP : Direction.DOWN;
        emit BetPlaced(betId, trader, symbol, targetPrice, collateral, actualMultiplier, direction, expiry);
    }

    function _validateAndGetMultiplier(
        uint256 entryPrice,
        uint256 targetPrice,
        uint256 expiry,
        uint256 expectedMultiplier
    ) internal view returns (uint256 actualMultiplier) {
        require(entryPrice > 0, "TBM: no price available");

        actualMultiplier = multiplierEngine.getMultiplier(
            entryPrice, targetPrice, expiry - block.timestamp
        );

        uint256 absDiff = actualMultiplier > expectedMultiplier
            ? actualMultiplier - expectedMultiplier
            : expectedMultiplier - actualMultiplier;
        require(
            absDiff * 10000 <= expectedMultiplier * MAX_MULTIPLIER_SLIPPAGE_BPS,
            "TBM: multiplier slippage exceeded"
        );
    }

    function _storeBet(
        address trader,
        bytes32 symbol,
        uint256 targetPrice,
        uint256 collateral,
        uint256 expiry,
        uint256 actualMultiplier,
        uint256 entryPrice
    ) internal returns (uint256 betId) {
        Direction direction = targetPrice >= entryPrice ? Direction.UP : Direction.DOWN;

        betId = nextBetId++;
        bets[betId] = Bet({
            betId:       betId,
            user:        trader,
            symbol:      symbol,
            targetPrice: targetPrice,
            collateral:  collateral,
            multiplier:  actualMultiplier,
            direction:   direction,
            expiry:      expiry,
            status:      BetStatus.ACTIVE,
            placedAt:    block.timestamp
        });
        userBets[trader].push(betId);
        activeBetIds.push(betId);
    }

    // ─── Settle win ────────────────────────────────────────────────────────────

    function settleBetWin(uint256 betId) external nonReentrant onlySettler {
        Bet storage bet = bets[betId];
        require(bet.betId == betId && bet.user != address(0), "TBM: bet not found");
        require(bet.status == BetStatus.ACTIVE, "TBM: not active");
        require(block.timestamp <= bet.expiry + 30, "TBM: settlement window passed");

        bet.status = BetStatus.WON;
        _removeFromActive(betId);

        uint256 totalPayout = (bet.collateral * bet.multiplier) / 100;
        vault.payout(bet.user, totalPayout);

        emit BetWon(betId, bet.user, msg.sender, totalPayout, 0);
    }

    // ─── Settle expired ────────────────────────────────────────────────────────

    function settleExpired(uint256 betId) external {
        Bet storage bet = bets[betId];
        require(bet.user != address(0),         "TBM: bet not found");
        require(bet.status == BetStatus.ACTIVE, "TBM: not active");
        require(block.timestamp > bet.expiry,   "TBM: not yet expired");

        bet.status = BetStatus.EXPIRED;
        _removeFromActive(betId);
        emit BetExpired(betId, bet.user);
    }

    function batchSettleExpired(uint256[] calldata betIds) external {
        for (uint256 i = 0; i < betIds.length; i++) {
            uint256 id = betIds[i];
            Bet storage bet = bets[id];
            if (bet.user == address(0)) continue;
            if (bet.status != BetStatus.ACTIVE) continue;
            if (block.timestamp <= bet.expiry) continue;

            bet.status = BetStatus.EXPIRED;
            _removeFromActive(id);
            emit BetExpired(id, bet.user);
        }
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function getActiveBets() external view returns (uint256[] memory) {
        return activeBetIds;
    }

    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _removeFromActive(uint256 betId) internal {
        uint256 len = activeBetIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (activeBetIds[i] == betId) {
                activeBetIds[i] = activeBetIds[len - 1];
                activeBetIds.pop();
                break;
            }
        }
    }

    receive() external payable {}
}

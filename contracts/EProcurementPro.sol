// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EProcurementPro
 * @notice Tier 3.0 decentralized application implementing the Contract,
 *         Token and part of the Business layer of the Enterprise Blockchain
 *         Design Framework (EBDF) for Nigerian public sector e-procurement.
 *
 *         Stakeholders (Business Layer):
 *          - BPP (Bureau of Public Procurement) -> contract owner / regulator
 *          - MDA (Ministries, Departments & Agencies) -> create proposals,
 *            open tenders and fund their eNGN escrow
 *          - Contractors -> submit bids, get paid in eNGN on award/settlement
 *          - Citizens -> vote on project proposals before a tender is opened
 *            (e-participation, Akaba et al., 2020)
 *
 *         Integrity: bidders hash their tender documents off-chain with
 *         SHA-256 and submit only the 32-byte digest on-chain, giving an
 *         immutable, tamper-evident fingerprint without storing documents
 *         on-chain.
 */
contract EProcurementPro is Ownable, ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Token
    // ---------------------------------------------------------------------
    IERC20 public immutable eNGN;

    // ---------------------------------------------------------------------
    // Roles
    // ---------------------------------------------------------------------
    mapping(address => bool) public isMDA;
    mapping(address => bool) public isContractor;

    event MDARegistered(address indexed account);
    event MDARevoked(address indexed account);
    event ContractorRegistered(address indexed account);
    event ContractorRevoked(address indexed account);

    modifier onlyMDA() {
        require(isMDA[msg.sender], "EProcurementPro: caller is not a registered MDA");
        _;
    }

    modifier onlyContractor() {
        require(isContractor[msg.sender], "EProcurementPro: caller is not a registered contractor");
        _;
    }

    // ---------------------------------------------------------------------
    // Citizen e-participation: project proposals & voting
    // ---------------------------------------------------------------------
    struct Proposal {
        uint256 id;
        address mda;
        string title;
        string description;
        uint256 voteCount;
        bool convertedToTender;
        bool exists;
    }

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnProposal;

    event ProposalCreated(uint256 indexed proposalId, address indexed mda, string title);
    event ProposalVoted(uint256 indexed proposalId, address indexed citizen, uint256 newVoteCount);

    // ---------------------------------------------------------------------
    // Tenders
    // ---------------------------------------------------------------------
    enum TenderStatus {
        Open,
        Closed,
        Awarded,
        Completed,
        Cancelled
    }

    struct Tender {
        uint256 id;
        address mda;
        uint256 proposalId; // 0 if not linked to a citizen proposal
        string title;
        string description;
        bytes32 documentHash; // SHA-256 fingerprint of the tender/ToR document
        uint256 budget; // eNGN escrowed for this tender
        uint256 amountPaid; // eNGN already released to the winning contractor
        uint256 deadline; // bid submission deadline (unix timestamp)
        TenderStatus status;
        uint256 winningBidId; // 0 if not yet awarded
        address winningContractor;
    }

    uint256 public tenderCount;
    mapping(uint256 => Tender) public tenders;

    // ---------------------------------------------------------------------
    // Bids
    // ---------------------------------------------------------------------
    struct Bid {
        uint256 id;
        uint256 tenderId;
        address contractor;
        uint256 amount; // eNGN amount bid for completing the contract
        bytes32 documentHash; // SHA-256 fingerprint of the bid/technical document
        uint8 score; // 0-100, set by BPP evaluators
        bool scored;
        bool disqualified;
        uint256 timestamp;
    }

    uint256 public bidCount;
    mapping(uint256 => Bid) public bids;
    mapping(uint256 => uint256[]) public bidsByTender; // tenderId => bidIds

    // ---------------------------------------------------------------------
    // Events - Tender / Bid lifecycle (audit trail)
    // ---------------------------------------------------------------------
    event TenderCreated(uint256 indexed tenderId, address indexed mda, string title, uint256 budget, uint256 deadline, bytes32 documentHash);
    event TenderClosed(uint256 indexed tenderId);
    event TenderCancelled(uint256 indexed tenderId, string reason);
    event BidSubmitted(uint256 indexed tenderId, uint256 indexed bidId, address indexed contractor, uint256 amount, bytes32 documentHash);
    event BidScored(uint256 indexed tenderId, uint256 indexed bidId, uint8 score);
    event BidDisqualified(uint256 indexed tenderId, uint256 indexed bidId, string reason);
    event TenderAwarded(uint256 indexed tenderId, uint256 indexed bidId, address indexed contractor);
    event MilestonePaid(uint256 indexed tenderId, address indexed contractor, uint256 amount, uint256 totalPaid);
    event TenderCompleted(uint256 indexed tenderId);

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------
    constructor(address engnTokenAddress, address bppAdmin) Ownable(bppAdmin) {
        require(engnTokenAddress != address(0), "EProcurementPro: eNGN address required");
        eNGN = IERC20(engnTokenAddress);
    }

    // ---------------------------------------------------------------------
    // BPP role administration
    // ---------------------------------------------------------------------
    function registerMDA(address account) external onlyOwner {
        require(account != address(0), "EProcurementPro: zero address");
        isMDA[account] = true;
        emit MDARegistered(account);
    }

    function revokeMDA(address account) external onlyOwner {
        isMDA[account] = false;
        emit MDARevoked(account);
    }

    function registerContractor(address account) external onlyOwner {
        require(account != address(0), "EProcurementPro: zero address");
        isContractor[account] = true;
        emit ContractorRegistered(account);
    }

    function revokeContractor(address account) external onlyOwner {
        isContractor[account] = false;
        emit ContractorRevoked(account);
    }

    // ---------------------------------------------------------------------
    // Citizen e-participation (Akaba et al., 2020)
    // ---------------------------------------------------------------------

    /// @notice An MDA proposes a candidate project for citizens to vote on
    ///         before it is opened as a formal tender.
    function createProposal(string calldata title, string calldata description) external onlyMDA returns (uint256) {
        proposalCount += 1;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            mda: msg.sender,
            title: title,
            description: description,
            voteCount: 0,
            convertedToTender: false,
            exists: true
        });
        emit ProposalCreated(proposalCount, msg.sender, title);
        return proposalCount;
    }

    /// @notice Any wallet (citizen) may cast one vote per proposal. This
    ///         keeps the barrier to on-chain civic participation low while
    ///         still producing an immutable, publicly auditable tally.
    function voteOnProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.exists, "EProcurementPro: proposal does not exist");
        require(!hasVotedOnProposal[proposalId][msg.sender], "EProcurementPro: already voted");

        hasVotedOnProposal[proposalId][msg.sender] = true;
        p.voteCount += 1;
        emit ProposalVoted(proposalId, msg.sender, p.voteCount);
    }

    // ---------------------------------------------------------------------
    // Tender creation & escrow funding
    // ---------------------------------------------------------------------

    /**
     * @notice Open a new tender and escrow its eNGN budget in this contract.
     *         The calling MDA must first call `eNGN.approve(procurementAddress, budget)`
     *         so the contract can pull the funds via transferFrom, mirroring
     *         a real budget-commitment step before advertising a tender.
     * @param proposalId Optional linked citizen proposal (0 if none).
     */
    function createTender(
        uint256 proposalId,
        string calldata title,
        string calldata description,
        bytes32 documentHash,
        uint256 budget,
        uint256 biddingWindowSeconds
    ) external onlyMDA nonReentrant returns (uint256) {
        require(budget > 0, "EProcurementPro: budget must be > 0");
        require(biddingWindowSeconds > 0, "EProcurementPro: bidding window must be > 0");

        if (proposalId != 0) {
            Proposal storage p = proposals[proposalId];
            require(p.exists, "EProcurementPro: proposal does not exist");
            require(p.mda == msg.sender, "EProcurementPro: not proposal owner");
            require(!p.convertedToTender, "EProcurementPro: proposal already used");
            p.convertedToTender = true;
        }

        bool ok = eNGN.transferFrom(msg.sender, address(this), budget);
        require(ok, "EProcurementPro: eNGN escrow transfer failed");

        tenderCount += 1;
        tenders[tenderCount] = Tender({
            id: tenderCount,
            mda: msg.sender,
            proposalId: proposalId,
            title: title,
            description: description,
            documentHash: documentHash,
            budget: budget,
            amountPaid: 0,
            deadline: block.timestamp + biddingWindowSeconds,
            status: TenderStatus.Open,
            winningBidId: 0,
            winningContractor: address(0)
        });

        emit TenderCreated(tenderCount, msg.sender, title, budget, tenders[tenderCount].deadline, documentHash);
        return tenderCount;
    }

    // ---------------------------------------------------------------------
    // Bidding
    // ---------------------------------------------------------------------

    function submitBid(uint256 tenderId, uint256 amount, bytes32 documentHash) external onlyContractor returns (uint256) {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Open, "EProcurementPro: tender not open");
        require(block.timestamp <= t.deadline, "EProcurementPro: bidding window closed");
        require(amount > 0 && amount <= t.budget, "EProcurementPro: bid must be within budget");

        bidCount += 1;
        bids[bidCount] = Bid({
            id: bidCount,
            tenderId: tenderId,
            contractor: msg.sender,
            amount: amount,
            documentHash: documentHash,
            score: 0,
            scored: false,
            disqualified: false,
            timestamp: block.timestamp
        });
        bidsByTender[tenderId].push(bidCount);

        emit BidSubmitted(tenderId, bidCount, msg.sender, amount, documentHash);
        return bidCount;
    }

    /// @notice Close bidding once the deadline has passed. Callable by
    ///         anyone so the state transition doesn't depend on the MDA
    ///         being online, but it only succeeds once the deadline is due.
    function closeBidding(uint256 tenderId) public {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Open, "EProcurementPro: tender not open");
        require(block.timestamp > t.deadline, "EProcurementPro: bidding window still active");
        t.status = TenderStatus.Closed;
        emit TenderClosed(tenderId);
    }

    /// @notice The MDA may cancel an un-awarded tender and reclaim escrowed funds.
    function cancelTender(uint256 tenderId, string calldata reason) external nonReentrant {
        Tender storage t = tenders[tenderId];
        require(msg.sender == t.mda || msg.sender == owner(), "EProcurementPro: not authorized");
        require(t.status == TenderStatus.Open || t.status == TenderStatus.Closed, "EProcurementPro: cannot cancel");

        t.status = TenderStatus.Cancelled;
        uint256 refund = t.budget - t.amountPaid;
        if (refund > 0) {
            bool ok = eNGN.transfer(t.mda, refund);
            require(ok, "EProcurementPro: refund transfer failed");
        }
        emit TenderCancelled(tenderId, reason);
    }

    // ---------------------------------------------------------------------
    // Evaluation (BPP)
    // ---------------------------------------------------------------------

    /// @notice BPP evaluators score a bid 0-100 based on technical and
    ///         financial criteria assessed off-chain; the score itself is
    ///         written on-chain for a tamper-evident evaluation record.
    function scoreBid(uint256 tenderId, uint256 bidId, uint8 score) external onlyOwner {
        require(score <= 100, "EProcurementPro: score must be 0-100");
        Bid storage b = bids[bidId];
        require(b.tenderId == tenderId, "EProcurementPro: bid/tender mismatch");
        require(!b.disqualified, "EProcurementPro: bid disqualified");

        b.score = score;
        b.scored = true;
        emit BidScored(tenderId, bidId, score);
    }

    function disqualifyBid(uint256 tenderId, uint256 bidId, string calldata reason) external onlyOwner {
        Bid storage b = bids[bidId];
        require(b.tenderId == tenderId, "EProcurementPro: bid/tender mismatch");
        b.disqualified = true;
        emit BidDisqualified(tenderId, bidId, reason);
    }

    /// @notice Verify a document (hashed off-chain with SHA-256 by the
    ///         caller's own tooling) against the fingerprint stored for a bid.
    function verifyBidDocument(uint256 bidId, bytes32 documentHash) external view returns (bool) {
        return bids[bidId].documentHash == documentHash;
    }

    /// @notice Verify a document against the fingerprint stored for a tender.
    function verifyTenderDocument(uint256 tenderId, bytes32 documentHash) external view returns (bool) {
        return tenders[tenderId].documentHash == documentHash;
    }

    // ---------------------------------------------------------------------
    // Award & settlement
    // ---------------------------------------------------------------------

    /// @notice BPP awards the tender to the highest-scoring, non-disqualified
    ///         bid once bidding is closed.
    function awardTender(uint256 tenderId, uint256 winningBidId) external onlyOwner {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Closed, "EProcurementPro: tender not closed");

        Bid storage winning = bids[winningBidId];
        require(winning.tenderId == tenderId, "EProcurementPro: bid/tender mismatch");
        require(!winning.disqualified, "EProcurementPro: winning bid disqualified");
        require(winning.scored, "EProcurementPro: winning bid not scored");

        t.status = TenderStatus.Awarded;
        t.winningBidId = winningBidId;
        t.winningContractor = winning.contractor;

        emit TenderAwarded(tenderId, winningBidId, winning.contractor);
    }

    /**
     * @notice Release an eNGN milestone payment to the winning contractor
     *         from the escrowed budget. Supports the "instant financial
     *         settlement" objective (Nodehi et al., 2022) by letting the BPP
     *         pay contractors immediately upon verifying a completed
     *         milestone, instead of the multi-month reconciliation delays
     *         typical of paper-based systems (Olatunji et al., 2016).
     */
    function releaseMilestonePayment(uint256 tenderId, uint256 amount) external onlyOwner nonReentrant {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Awarded, "EProcurementPro: tender not awarded");
        require(amount > 0, "EProcurementPro: amount must be > 0");
        require(t.amountPaid + amount <= t.budget, "EProcurementPro: exceeds escrowed budget");

        t.amountPaid += amount;
        bool ok = eNGN.transfer(t.winningContractor, amount);
        require(ok, "EProcurementPro: settlement transfer failed");

        emit MilestonePaid(tenderId, t.winningContractor, amount, t.amountPaid);

        if (t.amountPaid == t.budget) {
            t.status = TenderStatus.Completed;
            emit TenderCompleted(tenderId);
        }
    }

    /// @notice Convenience function that pays out the full remaining
    ///         escrowed budget in one instant settlement and marks the
    ///         tender complete.
    function awardAndSettle(uint256 tenderId, uint256 winningBidId) external onlyOwner nonReentrant {
        Tender storage t = tenders[tenderId];
        require(t.status == TenderStatus.Closed, "EProcurementPro: tender not closed");

        Bid storage winning = bids[winningBidId];
        require(winning.tenderId == tenderId, "EProcurementPro: bid/tender mismatch");
        require(!winning.disqualified, "EProcurementPro: winning bid disqualified");
        require(winning.scored, "EProcurementPro: winning bid not scored");

        t.status = TenderStatus.Completed;
        t.winningBidId = winningBidId;
        t.winningContractor = winning.contractor;

        uint256 payout = t.budget - t.amountPaid;
        t.amountPaid = t.budget;

        emit TenderAwarded(tenderId, winningBidId, winning.contractor);

        bool ok = eNGN.transfer(winning.contractor, payout);
        require(ok, "EProcurementPro: settlement transfer failed");

        emit MilestonePaid(tenderId, winning.contractor, payout, t.amountPaid);
        emit TenderCompleted(tenderId);
    }

    // ---------------------------------------------------------------------
    // Views / helpers for the frontend
    // ---------------------------------------------------------------------

    function getBidsForTender(uint256 tenderId) external view returns (uint256[] memory) {
        return bidsByTender[tenderId];
    }

    function getTender(uint256 tenderId) external view returns (Tender memory) {
        return tenders[tenderId];
    }

    function getBid(uint256 bidId) external view returns (Bid memory) {
        return bids[bidId];
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }
}

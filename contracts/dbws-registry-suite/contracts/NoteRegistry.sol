// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NoteRegistry — Registry 4 of the DBWS Registry Suite
 * @author Digital Plug Co. — Digital Black Wall Street
 * @notice $DPNOTE private-credit portfolio ledger. Notes are originated by
 *         the treasury (owner), track principal/interest/collateral, record
 *         payments, and expose portfolio-health metrics for VAULT-FIN.
 *         Collateral references a tokenId in the Entity / IP / License / Plug
 *         registries. Principal denominated in USDC (6 decimals).
 *
 * NOTE: This is the on-chain record of the credit book. Actual USDC custody
 *       and disbursement happen through the treasury; this ledger is the
 *       source of truth for portfolio reporting and secondary transfers.
 */
contract NoteRegistry is Ownable {
    enum NoteType { FIXED_TERM, ASSET_BACKED, REVENUE_PARTICIPATION, COMMUNITY }
    enum NoteStatus { ACTIVE, REPAID, DEFAULTED, RESTRUCTURED, SOLD }
    enum CollateralType { NONE, REAL_ESTATE, IP, ENTITY, CANNABIS_LICENSE, DOMAIN }

    struct Note {
        uint256 noteId;
        NoteType noteType;
        address borrower;
        address lender;
        uint256 principal;         // USDC (6d)
        uint256 interestRate;      // basis points
        uint256 originationDate;
        uint256 maturityDate;
        uint256 totalRepaid;
        NoteStatus status;
        CollateralType collateralType;
        uint256 collateralTokenId;
        uint256 ltv;               // basis points
        bool transferable;
        address currentHolder;
    }

    struct Payment {
        uint256 noteId;
        uint256 amount;
        uint256 timestamp;
        uint256 principalPortion;
        uint256 interestPortion;
    }

    mapping(uint256 => Note) public notes;
    mapping(uint256 => Payment[]) public paymentHistory;
    mapping(address => uint256[]) public borrowerNotes;
    mapping(address => uint256[]) public lenderNotes;

    uint256 public nextNoteId = 1;
    uint256 public totalPortfolioValue;
    uint256 public totalNotesOriginated;
    uint256 public totalRepaidCount;
    uint256 public totalDefaulted;

    event NoteOriginated(uint256 indexed noteId, address indexed borrower, uint256 principal, NoteType noteType, uint256 maturityDate);
    event PaymentReceived(uint256 indexed noteId, uint256 amount, uint256 remainingBalance, uint256 timestamp);
    event NoteDefaulted(uint256 indexed noteId, address borrower, uint256 outstandingBalance);
    event NoteTransferred(uint256 indexed noteId, address indexed from, address indexed to, uint256 transferPrice);
    event NoteRestructured(uint256 indexed noteId, uint256 newMaturity, uint256 newRate);

    error NotActive();
    error NotTransferable();
    error NotHolder();

    constructor(address admin) Ownable(admin) {}

    function originateNote(
        address _borrower,
        NoteType _type,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _termDays,
        CollateralType _collateralType,
        uint256 _collateralTokenId,
        uint256 _ltv
    ) external onlyOwner returns (uint256 noteId) {
        noteId = nextNoteId++;
        notes[noteId] = Note({
            noteId: noteId,
            noteType: _type,
            borrower: _borrower,
            lender: msg.sender,
            principal: _principal,
            interestRate: _interestRate,
            originationDate: block.timestamp,
            maturityDate: block.timestamp + (_termDays * 1 days),
            totalRepaid: 0,
            status: NoteStatus.ACTIVE,
            collateralType: _collateralType,
            collateralTokenId: _collateralTokenId,
            ltv: _ltv,
            transferable: true,
            currentHolder: msg.sender
        });

        borrowerNotes[_borrower].push(noteId);
        lenderNotes[msg.sender].push(noteId);
        totalNotesOriginated++;
        totalPortfolioValue += _principal;

        emit NoteOriginated(noteId, _borrower, _principal, _type, notes[noteId].maturityDate);
    }

    function recordPayment(
        uint256 _noteId,
        uint256 _amount,
        uint256 _principalPortion,
        uint256 _interestPortion
    ) external onlyOwner {
        Note storage n = notes[_noteId];
        if (n.status != NoteStatus.ACTIVE) revert NotActive();

        n.totalRepaid += _amount;
        paymentHistory[_noteId].push(Payment({
            noteId: _noteId,
            amount: _amount,
            timestamp: block.timestamp,
            principalPortion: _principalPortion,
            interestPortion: _interestPortion
        }));

        uint256 remaining = n.principal > n.totalRepaid ? n.principal - n.totalRepaid : 0;
        if (remaining == 0) {
            n.status = NoteStatus.REPAID;
            totalRepaidCount++;
            if (totalPortfolioValue >= n.principal) totalPortfolioValue -= n.principal;
        }
        emit PaymentReceived(_noteId, _amount, remaining, block.timestamp);
    }

    function markDefault(uint256 _noteId) external onlyOwner {
        Note storage n = notes[_noteId];
        if (n.status != NoteStatus.ACTIVE) revert NotActive();
        require(block.timestamp > n.maturityDate, "NOT_MATURE");
        n.status = NoteStatus.DEFAULTED;
        totalDefaulted++;
        uint256 outstanding = n.principal > n.totalRepaid ? n.principal - n.totalRepaid : 0;
        emit NoteDefaulted(_noteId, n.borrower, outstanding);
    }

    function restructureNote(uint256 _noteId, uint256 _newTermDays, uint256 _newRate)
        external
        onlyOwner
    {
        Note storage n = notes[_noteId];
        n.maturityDate = block.timestamp + (_newTermDays * 1 days);
        n.interestRate = _newRate;
        n.status = NoteStatus.RESTRUCTURED;
        emit NoteRestructured(_noteId, n.maturityDate, _newRate);
    }

    /// @notice Sell a note to a secondary holder (off-chain settled price).
    function transferNote(uint256 _noteId, address _to, uint256 _price) external {
        Note storage n = notes[_noteId];
        if (n.currentHolder != msg.sender) revert NotHolder();
        if (!n.transferable) revert NotTransferable();
        address from = n.currentHolder;
        n.currentHolder = _to;
        n.status = NoteStatus.SOLD;
        emit NoteTransferred(_noteId, from, _to, _price);
    }

    function getPaymentHistory(uint256 _noteId) external view returns (Payment[] memory) {
        return paymentHistory[_noteId];
    }

    function getBorrowerNotes(address b) external view returns (uint256[] memory) {
        return borrowerNotes[b];
    }

    function getPortfolioHealth()
        external
        view
        returns (uint256 totalValue, uint256 originated, uint256 defaulted, uint256 repaid)
    {
        return (totalPortfolioValue, totalNotesOriginated, totalDefaulted, totalRepaidCount);
    }
}

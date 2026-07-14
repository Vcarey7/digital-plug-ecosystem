import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';

// Commit-reveal state machine for PlugRegistry domain registration.
//
// HARD RULE (BUILD_PROMPT_PHASE2c_DASHBOARD.md): the secret must live in
// React state only, never localStorage/sessionStorage. A page refresh
// mid-flow loses the secret and the pending commitment becomes
// unrevealable until it expires (maxCommitmentAge) and the user restarts —
// callers must warn the user not to refresh between commit and reveal.

const STEP = {
  IDLE: 'idle',
  COMMITTING: 'committing',
  WAITING: 'waiting',
  READY: 'ready',
  REVEALING: 'revealing',
  DONE: 'done',
  EXPIRED: 'expired',
  ERROR: 'error',
};

export function useCommitReveal() {
  const { getContract, account } = useWeb3();

  const [step, setStep] = useState(STEP.IDLE);
  const [error, setError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [tokenId, setTokenId] = useState(null);

  // Held only in a ref/state for the lifetime of this hook instance --
  // never persisted.
  const secretRef = useRef(null);
  const commitDataRef = useRef(null); // { tld, name, to, yearsCount, metadataURI }
  const committedAtRef = useRef(null);
  const agesRef = useRef({ min: 60, max: 86400 });
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    secretRef.current = null;
    commitDataRef.current = null;
    committedAtRef.current = null;
    setStep(STEP.IDLE);
    setError(null);
    setSecondsRemaining(0);
    setTokenId(null);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // `chainOffset` corrects for drift between the chain's block.timestamp and
  // this machine's wall clock (real on local Hardhat nodes, and possible on
  // any chain) -- without it, a chain clock running ahead of/behind the
  // browser can strand the UI in WAITING (or misfire EXPIRED) forever.
  const startCountdown = useCallback((committedAt, minAge, maxAge, chainOffset) => {
    clearInterval(timerRef.current);
    const readyAt = committedAt + minAge;
    const expiresAt = committedAt + maxAge;

    const tick = () => {
      const now = Math.floor(Date.now() / 1000) + chainOffset;
      if (now >= expiresAt) {
        clearInterval(timerRef.current);
        setStep(STEP.EXPIRED);
        setSecondsRemaining(0);
        return;
      }
      if (now >= readyAt) {
        clearInterval(timerRef.current);
        setStep(STEP.READY);
        setSecondsRemaining(0);
        return;
      }
      setSecondsRemaining(readyAt - now);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  // Step 1: generate a random secret, submit the commitment on-chain.
  const startCommit = useCallback(
    async ({ tld, name, yearsCount, metadataURI = '' }) => {
      if (!account) throw new Error('Wallet not connected');
      setError(null);
      setStep(STEP.COMMITTING);
      try {
        const registry = getContract('PlugRegistry', true);
        const [minAge, maxAge] = await Promise.all([
          registry.minCommitmentAge(),
          registry.maxCommitmentAge(),
        ]);
        agesRef.current = { min: Number(minAge), max: Number(maxAge) };

        const secretBytes = ethers.randomBytes(32);
        const secret = ethers.hexlify(secretBytes);
        secretRef.current = secret;
        commitDataRef.current = { tld, name, to: account, yearsCount, metadataURI };

        const commitment = await registry.makeCommitment(tld, name, account, secret);
        const tx = await registry.commit(commitment);
        const receipt = await tx.wait();
        const block = await receipt.provider.getBlock(receipt.blockNumber);
        const committedAt = block.timestamp;
        committedAtRef.current = committedAt;
        const chainOffset = committedAt - Math.floor(Date.now() / 1000);

        setStep(STEP.WAITING);
        startCountdown(committedAt, agesRef.current.min, agesRef.current.max, chainOffset);
        return { commitment, committedAt };
      } catch (e) {
        setError(e.shortMessage || e.message || String(e));
        setStep(STEP.ERROR);
        throw e;
      }
    },
    [account, getContract, startCountdown]
  );

  // Step 2: reveal -- calls registerDomain with the held secret.
  const reveal = useCallback(async () => {
    if (step !== STEP.READY) throw new Error('Commitment not ready to reveal yet');
    if (!secretRef.current || !commitDataRef.current) {
      throw new Error('No pending commitment in this session (do not refresh mid-flow)');
    }
    setError(null);
    setStep(STEP.REVEALING);
    try {
      const registry = getContract('PlugRegistry', true);
      const { tld, name, to, yearsCount, metadataURI } = commitDataRef.current;
      const tx = await registry.registerDomain(
        tld,
        name,
        to,
        yearsCount,
        metadataURI,
        secretRef.current
      );
      const receipt = await tx.wait();

      let mintedId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = registry.interface.parseLog(log);
          if (parsed?.name === 'DomainRegistered') {
            mintedId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // not a PlugRegistry log, skip
        }
      }

      setTokenId(mintedId);
      setStep(STEP.DONE);
      secretRef.current = null;
      return { tokenId: mintedId, txHash: receipt.hash };
    } catch (e) {
      setError(e.shortMessage || e.message || String(e));
      setStep(STEP.ERROR);
      throw e;
    }
  }, [step, getContract]);

  return {
    step,
    STEP,
    error,
    secondsRemaining,
    tokenId,
    minCommitmentAge: agesRef.current.min,
    maxCommitmentAge: agesRef.current.max,
    startCommit,
    reveal,
    reset,
  };
}

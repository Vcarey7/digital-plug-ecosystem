// Persists in-flight commit-reveal registrations to localStorage so a user
// can close the tab between the commit and register transactions (the
// contract requires at least a 1 minute gap) and pick up where they left off.
const STORAGE_KEY = 'dpd:pendingCommitments';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function savePendingCommitment(fullName, { owner, secret, committedAt }) {
  const all = readAll();
  all[fullName] = { owner, secret, committedAt };
  writeAll(all);
}

export function getPendingCommitment(fullName) {
  return readAll()[fullName] || null;
}

export function clearPendingCommitment(fullName) {
  const all = readAll();
  delete all[fullName];
  writeAll(all);
}

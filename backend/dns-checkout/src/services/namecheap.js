import { XMLParser } from 'fast-xml-parser';
import { env } from '../lib/env.js';

// Thin wrapper over the Namecheap reseller (XML) API --
// https://www.namecheap.com/support/api/methods/ -- sandbox by default via
// NAMECHEAP_API_BASE. Every method throws NamecheapNotConfiguredError until
// NAMECHEAP_API_USER/API_KEY/USERNAME/CLIENT_IP are all set (see
// README.md for the sandbox signup walkthrough) -- nothing here silently
// no-ops or fakes a response.

export class NamecheapNotConfiguredError extends Error {
  constructor() {
    super('Namecheap API is not configured (missing API_USER/API_KEY/USERNAME/CLIENT_IP env vars)');
    this.name = 'NamecheapNotConfiguredError';
  }
}

export class NamecheapApiError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'NamecheapApiError';
    this.errors = errors;
  }
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

function assertConfigured() {
  if (!env.namecheap.isConfigured()) throw new NamecheapNotConfiguredError();
}

async function call(command, params = {}) {
  assertConfigured();
  const qs = new URLSearchParams({
    ApiUser: env.namecheap.apiUser,
    ApiKey: env.namecheap.apiKey,
    UserName: env.namecheap.username,
    ClientIp: env.namecheap.clientIp,
    Command: command,
    ...params,
  });
  const res = await fetch(`${env.namecheap.apiBase}?${qs.toString()}`);
  const body = await res.text();
  const parsed = parser.parse(body);
  const root = parsed.ApiResponse;
  if (!root) throw new NamecheapApiError('Unrecognized Namecheap API response', body);
  if (root.Status !== 'OK') {
    const errors = root.Errors?.Error;
    const list = Array.isArray(errors) ? errors : errors ? [errors] : [];
    throw new NamecheapApiError(
      list.map((e) => (typeof e === 'object' ? e['#text'] : e)).join('; ') || 'Namecheap API call failed',
      list
    );
  }
  return root.CommandResponse;
}

function splitDomain(domain) {
  const idx = domain.indexOf('.');
  return { sld: domain.slice(0, idx), tld: domain.slice(idx + 1) };
}

/** @returns {Promise<{ domain: string, available: boolean, premium: boolean }>} */
export async function checkAvailability(domain) {
  const resp = await call('namecheap.domains.check', { DomainList: domain });
  const result = resp.DomainCheckResult;
  return {
    domain: result.Domain,
    available: result.Available === 'true',
    premium: result.IsPremiumName === 'true',
  };
}

/**
 * Registers a domain for `years`. `contact` fields are required by
 * Namecheap for every registration (registrant/admin/tech/aux-billing) --
 * caller supplies them from the customer record, never hardcoded here.
 */
export async function registerDomain(domain, years, contact) {
  const { sld, tld } = splitDomain(domain);
  const resp = await call('namecheap.domains.create', {
    DomainName: domain,
    Years: years,
    ...contactParams(contact),
  });
  const result = resp.DomainCreateResult;
  return {
    domain: result.Domain,
    registered: result.Registered === 'true',
    chargedAmount: result.ChargedAmount,
    orderId: result.OrderID,
    transactionId: result.TransactionID,
  };
}

export async function renewDomain(domain, years) {
  const resp = await call('namecheap.domains.renew', { DomainName: domain, Years: years });
  const result = resp.DomainRenewResult;
  return {
    domain: result.Domain,
    renewed: result.Renew === 'true',
    orderId: result.OrderID,
    chargedAmount: result.ChargedAmount,
  };
}

/** Points a domain at the given nameservers (e.g. our own DNS hosting, or a provider's). */
export async function setNameservers(domain, nameservers) {
  const { sld, tld } = splitDomain(domain);
  await call('namecheap.domains.dns.setCustom', {
    SLD: sld,
    TLD: tld,
    Nameservers: nameservers.join(','),
  });
  return { domain, nameservers };
}

/** Sets individual DNS host records (A/CNAME/TXT/MX/...) via Namecheap's own default DNS. */
export async function setHostRecords(domain, records) {
  const { sld, tld } = splitDomain(domain);
  const params = { SLD: sld, TLD: tld };
  records.forEach((r, i) => {
    const n = i + 1;
    params[`HostName${n}`] = r.hostname;
    params[`RecordType${n}`] = r.type;
    params[`Address${n}`] = r.address;
    params[`TTL${n}`] = String(r.ttl ?? 1800);
  });
  await call('namecheap.domains.dns.setHosts', params);
  return { domain, records };
}

/**
 * Pulls Namecheap's current wholesale pricing for every TLD they sell.
 * Used by the pricing sync job to populate `dns_tlds`.
 * @returns {Promise<Array<{ tld: string, registerPriceUsd: number }>>}
 */
export async function getTldPricing() {
  const resp = await call('namecheap.users.getPricing', { ProductType: 'DOMAIN', ProductCategory: 'REGISTER' });
  const categories = resp.UserGetPricingResult?.ProductType?.ProductCategory;
  const list = Array.isArray(categories) ? categories : [categories];
  const registerCategory = list.find((c) => c.Name === 'register');
  const products = registerCategory?.Product;
  const productList = Array.isArray(products) ? products : [products];
  return productList
    .filter(Boolean)
    .map((p) => {
      const prices = Array.isArray(p.Price) ? p.Price : [p.Price];
      const oneYear = prices.find((pr) => pr.Duration === '1') || prices[0];
      return { tld: p.Name, registerPriceUsd: Number(oneYear.Price) };
    });
}

function contactParams(contact) {
  const roles = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
  const params = {};
  for (const role of roles) {
    params[`${role}FirstName`] = contact.firstName;
    params[`${role}LastName`] = contact.lastName;
    params[`${role}Address1`] = contact.address1;
    params[`${role}City`] = contact.city;
    params[`${role}StateProvince`] = contact.state;
    params[`${role}PostalCode`] = contact.postalCode;
    params[`${role}Country`] = contact.country;
    params[`${role}Phone`] = contact.phone;
    params[`${role}EmailAddress`] = contact.email;
  }
  return params;
}

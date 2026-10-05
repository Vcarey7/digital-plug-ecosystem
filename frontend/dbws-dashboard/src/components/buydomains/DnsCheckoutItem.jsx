import React, { useState, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import { STRIPE_PUBLISHABLE_KEY, createDnsCheckout } from '../../config/backend';
import { useNotification } from '../../contexts/NotificationContext';

const cardElementStyle = {
  style: {
    base: { color: '#f5f0e8', fontSize: '14px', '::placeholder': { color: '#6a6055' } },
    invalid: { color: '#e74c3c' },
  },
};

// One Stripe Elements instance per checkout item keeps each item's card
// entry isolated -- simplest correct thing for a cart that can hold
// several DNS names at once, each paid for separately (one order row per
// domain, matching the backend's design).
export default function DnsCheckoutItem({ item, onDone }) {
  const stripePromise = useMemo(
    () => (STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null),
    []
  );

  if (!STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--red)' }}>
        VITE_STRIPE_PUBLISHABLE_KEY is not set -- cannot collect card payment for {item.domain}.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <DnsCheckoutForm item={item} onDone={onDone} />
    </Elements>
  );
}

function DnsCheckoutForm({ item, onDone }) {
  const stripe = useStripe();
  const elements = useElements();
  const { showSuccess, showError } = useNotification();

  const [step, setStep] = useState('form'); // form | processing | done
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState({
    firstName: '', lastName: '', address1: '', city: '', state: '', postalCode: '', country: 'US', phone: '',
  });

  const idempotencyKey = useMemo(
    () => `${item.domain}:${item.years}:${Date.now()}`,
    [item.domain, item.years]
  );

  const update = (k) => (e) => setContact({ ...contact, [k]: e.target.value });

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const missing = ['firstName', 'lastName', 'address1', 'city', 'state', 'postalCode', 'phone'].filter((k) => !contact[k]);
    if (!email || missing.length) return showError('Missing fields', 'Email and all registrant contact fields are required.');

    setStep('processing');
    try {
      const { clientSecret, reused } = await createDnsCheckout({
        domain: item.domain,
        years: item.years,
        customerEmail: email,
        idempotencyKey,
        contact,
      });
      if (reused) {
        setStep('done');
        showSuccess('Already processed', `${item.domain} was already checked out.`);
        onDone?.();
        return;
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: { name: `${contact.firstName} ${contact.lastName}`, email },
        },
      });
      if (result.error) throw new Error(result.error.message);

      setStep('done');
      showSuccess('Payment succeeded', `${item.domain} is being registered — this finishes server-side once Namecheap confirms.`);
      onDone?.();
    } catch (err) {
      setStep('form');
      showError('Payment failed', err.message);
    }
  };

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--green)' }}>
        <CheckCircle2 size={16} /> {item.domain} — paid, registration in progress.
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} className="space-y-3">
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder="First name" value={contact.firstName} onChange={update('firstName')} />
        <input className="input" placeholder="Last name" value={contact.lastName} onChange={update('lastName')} />
        <input className="input col-span-2" placeholder="Address" value={contact.address1} onChange={update('address1')} />
        <input className="input" placeholder="City" value={contact.city} onChange={update('city')} />
        <input className="input" placeholder="State" value={contact.state} onChange={update('state')} />
        <input className="input" placeholder="Postal code" value={contact.postalCode} onChange={update('postalCode')} />
        <input className="input" placeholder="Phone" value={contact.phone} onChange={update('phone')} />
      </div>
      <div className="input">
        <CardElement options={cardElementStyle} />
      </div>
      <button type="submit" disabled={step === 'processing'} className="btn-primary w-full flex items-center justify-center gap-2">
        {step === 'processing' ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
        {step === 'processing' ? 'Processing…' : `Pay for ${item.domain}`}
      </button>
    </form>
  );
}

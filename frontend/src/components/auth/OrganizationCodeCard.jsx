import { Check, Copy, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PLATFORM_NAME } from '../../config/platform';
import { OrganizationMark } from './OrganizationMark';

/** The code staff need to find this organisation, with copy and WhatsApp share. */
export function OrganizationCodeCard() {
  const { organization } = useAuth();
  const [isCopied, setIsCopied] = useState(false);
  const signInUrl = `${window.location.origin}/signin/${organization.code}`;
  const shareText = `Join ${organization.name} on ${PLATFORM_NAME}: ${signInUrl} (organisation code ${organization.code}). Sign in with your work email.`;
  const copy = async () => {
    await navigator.clipboard?.writeText(organization.code).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  return (
    <div className="code-banner">
      <OrganizationMark name={organization.name} logoUrl={organization.logoUrl} size={40} />
      <div className="code-banner__text">
        <span className="muted">Staff join {organization.name} with this code</span>
        <strong className="mono">{organization.code}</strong>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="button button--secondary button--sm" onClick={copy}>
          {isCopied ? <Check size={14} /> : <Copy size={14} />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
        <a className="button button--secondary button--sm" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={14} />
          <span>Share</span>
        </a>
      </div>
    </div>
  );
}

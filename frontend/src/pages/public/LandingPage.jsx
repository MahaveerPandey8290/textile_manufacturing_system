import {
  ArrowRight, BadgeIndianRupee, BarChart3, Boxes, Building2, CalendarCheck, ClipboardCheck, Crown, Factory, FileText,
  KeyRound, Link2, Lock, PackageCheck, Ruler, ShieldCheck, ShoppingBag, Smartphone, Truck, UserRound, Users,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getRememberedOrganization } from '../../auth/rememberedOrganization';
import { OrganizationMark, PlatformMark } from '../../components/auth/OrganizationMark';
import { LANDING_PHOTOS } from '../../config/landingImages';
import { PLATFORM_NAME } from '../../config/platform';
import { LoomScene, SWATCHES, Swatch, YarnCones } from './LoomScene';
import '../../styles/landing.css';

const FLOW = [
  { icon: Truck, title: 'Yarn at the gate', text: 'Gate entry (GRN) with challan, bill and cost per kg.' },
  { icon: Boxes, title: 'Yarn store', text: 'Live kg balance, reorder alerts, issue to orders.' },
  { icon: Factory, title: 'Production floor', text: 'Jobs on spinning frames, looms and dyeing machines.' },
  { icon: ClipboardCheck, title: 'Quality check', text: 'Every roll inspected, graded and traceable.' },
  { icon: PackageCheck, title: 'Dispatch', text: 'Pick passed rolls, load the truck, print the challan.' },
  { icon: FileText, title: 'GST invoice', text: 'Raised from exactly the rolls on the truck.' },
  { icon: ShoppingBag, title: 'Buyer tracking', text: 'Buyers follow their order without calling you.' },
];

const FEATURES = [
  { icon: Boxes, title: 'Yarn inventory', text: 'Weighted average cost, stock ledger, low-stock alerts and a "can we start?" check before you take an order.' },
  { icon: Factory, title: 'Machine board', text: 'Which order is on which loom, what is idle, breakdowns and downtime, refreshed live.' },
  { icon: ClipboardCheck, title: 'Roll-level QC', text: 'Pass, rework or reject with defect types, A/B/C grades and defects by machine.' },
  { icon: Truck, title: 'Dispatch and challan', text: 'Only passed rolls can be loaded. The delivery challan and invoice print together.' },
  { icon: CalendarCheck, title: 'Attendance and wages', text: 'Daily register with half days, leave and overtime, then a monthly payroll in one click.' },
  { icon: BarChart3, title: 'Costing and profit', text: 'Yarn, machine-hour and labour cost per order, against what the buyer pays.' },
  { icon: BadgeIndianRupee, title: 'Receivables and payables', text: 'Buyer invoices, supplier bills, part payments by UPI, NEFT, cheque or cash.' },
  { icon: Link2, title: 'Buyer portal', text: 'Buyers sign in to see their orders and invoices, or open a public tracking link.' },
];

const ROLES = [
  { icon: Crown, role: 'Owner', text: 'Sees and does everything, invites the team, owns the organisation code.' },
  { icon: Factory, role: 'Production manager', text: 'Recipes, machines, jobs, output, rolls and the attendance register.' },
  { icon: Boxes, role: 'Store manager', text: 'Gate entries, yarn issues, stock counts and loading trucks.' },
  { icon: ClipboardCheck, role: 'Quality inspector', text: 'Inspects every roll, records defects and grades.' },
  { icon: BadgeIndianRupee, role: 'Accountant', text: 'Orders, invoices, payments, payroll and month-end.' },
  { icon: ShoppingBag, role: 'Buyer', text: 'Their own orders, deliveries and invoices. Nothing else.' },
];

const SPECS = [
  { icon: Lock, label: 'Isolation', value: 'Each organisation gets its own database schema' },
  { icon: KeyRound, label: 'Sign-in', value: 'Organisation code, role and work email' },
  { icon: ShieldCheck, label: 'Verification', value: '6-digit email codes for setup and resets' },
  { icon: Users, label: 'Roles', value: 'Owner, production, store, quality, accounts, buyer' },
  { icon: Ruler, label: 'Units', value: 'Kilograms for yarn, metres for cloth, rupees for money' },
  { icon: FileText, label: 'Tax', value: 'GST on every invoice, GSTIN on every party' },
  { icon: Smartphone, label: 'Devices', value: 'Works on the shop-floor phone and the office PC' },
  { icon: Building2, label: 'Stages', value: 'Spinning, weaving and dyeing' },
];

/** Fades sections in as they scroll into view. */
function useReveal() {
  const rootRef = useRef(null);
  useEffect(() => {
    const targets = rootRef.current?.querySelectorAll('[data-reveal]') ?? [];
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && (entry.target.classList.add('is-visible'), observer.unobserve(entry.target))),
      { threshold: 0.15 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  return rootRef;
}

/** Public front page: what the platform does for a textile business, and the ways in. */
export default function LandingPage() {
  const rootRef = useReveal();
  const remembered = getRememberedOrganization();
  const rememberedPath = remembered && (remembered.entry === 'organization' ? '/organization/signin' : `/signin/${remembered.code}`);

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-nav">
        <Link to="/" className="landing-nav__brand">
          <PlatformMark size={32} />
          <strong>{PLATFORM_NAME}</strong>
        </Link>
        <nav className="landing-nav__links" aria-label="Sections">
          <a href="#flow">How it works</a>
          <a href="#features">Features</a>
          <a href="#roles">Roles</a>
          <a href="#specs">Specs</a>
        </nav>
        <div className="landing-nav__actions">
          {remembered ? (
            <Link to={rememberedPath} className="landing-nav__remembered">
              <OrganizationMark name={remembered.name} logoUrl={remembered.logoUrl} size={24} />
              <span>{remembered.name}</span>
            </Link>
          ) : (
            <Link to="/welcome" className="button button--ghost button--md">Sign in</Link>
          )}
          <Link to="/signup" className="button button--primary button--md">Register your mill</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy" data-reveal>
          <p className="landing-eyebrow">Mill management for textile businesses</p>
          <h1>From yarn bale to buyer&apos;s invoice, woven into one system.</h1>
          <p className="landing-lead">
            {PLATFORM_NAME} replaces the gate register, the stock book, the QC slips and the month-end spreadsheet. Your
            store, floor, quality and accounts teams work on the same order, live.
          </p>
          <div className="landing-hero__ctas">
            <Link to="/signup" className="button button--primary landing-button">
              Register your mill <ArrowRight size={18} />
            </Link>
            <Link to="/signin" className="button button--secondary landing-button">
              <UserRound size={18} /> I have an organisation code
            </Link>
          </div>
          <p className="landing-hero__note">
            Already registered? <Link to="/organization/signin">Sign in as organisation</Link>
          </p>
          <ul className="landing-hero__stages" aria-label="Works for">
            <li>Spinning</li><li>Weaving</li><li>Dyeing</li><li>Processing</li>
          </ul>
        </div>
        <div className="landing-hero__art" data-reveal>
          <div className="landing-hero__frame">
            <LoomScene />
          </div>
          <div className="landing-hero__chip landing-hero__chip--top">
            <ClipboardCheck size={16} /> RL-2026-00010 passed · Grade A
          </div>
          <div className="landing-hero__chip landing-hero__chip--bottom">
            <Truck size={16} /> DSP-2026-00001 loaded · 1,000 m
          </div>
        </div>
      </section>

      <div className="landing-selvedge" aria-hidden />

      <section className="landing-swatches" aria-label="Fabrics our mills make">
        <div className="landing-swatches__track">
          {[...SWATCHES, ...SWATCHES].map((swatch, index) => (
            <Swatch key={`${swatch.name}-${index}`} {...swatch} />
          ))}
        </div>
      </section>

      <section id="flow" className="landing-section">
        <div className="landing-section__head" data-reveal>
          <p className="landing-eyebrow">How it works</p>
          <h2>How a metre of cloth moves through your mill</h2>
          <p className="landing-lead">Every step updates the next one. Nobody re-types an order number.</p>
        </div>
        <ol className="landing-flow">
          {FLOW.map((step, index) => (
            <li key={step.title} className="landing-flow__step" data-reveal style={{ transitionDelay: `${index * 70}ms` }}>
              <span className="landing-flow__icon"><step.icon size={20} /></span>
              <span className="landing-flow__number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="landing-section landing-section--cotton">
        <div className="landing-section__head" data-reveal>
          <p className="landing-eyebrow">Features</p>
          <h2>Everything the registers used to hold</h2>
        </div>
        <div className="landing-features">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing-feature" data-reveal>
              <span className="landing-feature__icon"><feature.icon size={20} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-gallery-section">
        <div className="landing-section__head" data-reveal>
          <p className="landing-eyebrow">On the floor</p>
          <h2>Built around yarn, looms and rolls</h2>
        </div>
        {LANDING_PHOTOS.length > 0 ? (
          <div className="landing-gallery">
            {LANDING_PHOTOS.map((photo) => (
              <figure key={photo.src} className="landing-photo" data-reveal>
                <img src={photo.src} alt={photo.alt} loading="lazy" />
                <figcaption>
                  <strong>{photo.caption}</strong>
                  {photo.credit && <span>{photo.credit}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="landing-gallery">
            <figure className="landing-tile landing-tile--yarn" data-reveal>
              <YarnCones />
              <figcaption><strong>Yarn in</strong><span>Cones by count, colour and supplier</span></figcaption>
            </figure>
            <figure className="landing-tile landing-tile--cloth" data-reveal>
              <div className="landing-tile__fold" />
              <figcaption><strong>Cloth out</strong><span>Every roll numbered, graded and traced</span></figcaption>
            </figure>
            <figure className="landing-tile landing-tile--thread" data-reveal>
              <svg viewBox="0 0 300 160" aria-hidden className="landing-thread">
                <path d="M-10 120 C 60 20, 120 160, 180 70 S 290 40, 320 110" />
                <path d="M-10 70 C 70 150, 140 10, 200 100 S 280 140, 320 50" />
              </svg>
              <figcaption><strong>One thread</strong><span>From gate entry to the buyer&apos;s invoice</span></figcaption>
            </figure>
          </div>
        )}
      </section>

      <section id="roles" className="landing-section landing-section--indigo">
        <div className="landing-section__head" data-reveal>
          <p className="landing-eyebrow">Roles</p>
          <h2>Each person sees their part of the mill</h2>
          <p className="landing-lead">Staff join with your organisation code and their work email. The owner decides who does what.</p>
        </div>
        <div className="landing-roles">
          {ROLES.map((item) => (
            <article key={item.role} className="landing-role" data-reveal>
              <item.icon size={20} />
              <h3>{item.role}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="specs" className="landing-section">
        <div className="landing-section__head" data-reveal>
          <p className="landing-eyebrow">Platform specs</p>
          <h2>Made for many mills, each kept apart</h2>
        </div>
        <dl className="landing-specs" data-reveal>
          {SPECS.map((spec) => (
            <div key={spec.label} className="landing-spec">
              <dt><spec.icon size={16} /> {spec.label}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="landing-cta" data-reveal>
        <div>
          <h2>Bring your mill online today</h2>
          <p>Register in two minutes, get your organisation code, and invite your team.</p>
        </div>
        <div className="landing-hero__ctas">
          <Link to="/signup" className="button button--primary landing-button landing-button--light">
            Register your mill <ArrowRight size={18} />
          </Link>
          <Link to="/signin" className="button button--secondary landing-button">Staff sign in</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="landing-nav__brand"><PlatformMark size={24} /> <strong>{PLATFORM_NAME}</strong></span>
        <span>© {new Date().getFullYear()} {PLATFORM_NAME}. The operating system for textile mills.</span>
        <Link to="/platform/login">Admin console</Link>
      </footer>
    </div>
  );
}

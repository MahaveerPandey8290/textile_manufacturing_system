import { Ban, Building2, Mail, MapPin, Phone, PlayCircle, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { OrganizationMark } from '../../components/auth/OrganizationMark';
import { EventLine } from '../../components/platform/PlatformShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { Modal } from '../../components/ui/Modal';
import { FullPageSpinner } from '../../components/ui/Spinner';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ROLE_LABELS } from '../../config/navigation';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { formatDate, formatDateTime, formatNumber, formatRelative, formatRupeesShort, humanize } from '../../utils/format';

export default function OrganizationDetailPage() {
  const { organizationId } = useParams();
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const { data: organization, isLoading, error, refetch } = useApiQuery(`/platform/organizations/${organizationId}`);
  if (isLoading) return <FullPageSpinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const isSuspended = organization.status === 'SUSPENDED';
  return (
    <div className="stack">
      <div className="breadcrumbs"><Link to="/platform/organizations">Organisations</Link> / {organization.name}</div>
      <div className="org-header card">
        <OrganizationMark name={organization.name} logoUrl={organization.logo_url} size={64} />
        <div className="org-header__text">
          <div className="row" style={{ gap: 10 }}>
            <h1>{organization.name}</h1>
            <StatusBadge status={organization.status} />
          </div>
          <div className="org-header__meta">
            <span className="mono">{organization.organization_code}</span>
            <span><MapPin size={13} /> {organization.city}</span>
            <span><Mail size={13} /> @{organization.email_domain}</span>
            {organization.phone && <span><Phone size={13} /> {organization.phone}</span>}
            {organization.gst_number && <span><Receipt size={13} /> {organization.gst_number}</span>}
            <span><Building2 size={13} /> Joined {formatDate(organization.created_at)}</span>
          </div>
          {isSuspended && (
            <div className="callout callout--danger" style={{ marginTop: 10 }}>
              Suspended {formatRelative(organization.suspended_at)}: {organization.suspended_reason}
            </div>
          )}
        </div>
        <Button variant={isSuspended ? 'primary' : 'danger'} icon={isSuspended ? PlayCircle : Ban} onClick={() => setIsChangingStatus(true)}>
          {isSuspended ? 'Reactivate' : 'Suspend'}
        </Button>
      </div>

      <div className="grid grid--stats">
        <StatCard label="People with access" value={organization.active_user_count} hint={organization.invited_user_count ? `${organization.invited_user_count} invited, not set up yet` : 'Everyone is set up'} tone="teal" />
        <StatCard label="Open orders" value={organization.open_order_count} hint={`${organization.order_count} in total`} tone="purple" />
        <StatCard label="Machines" value={organization.machine_count} tone="brand" />
        <StatCard label="Invoiced this month" value={formatRupeesShort(organization.revenue_this_month)} tone="success" />
      </div>

      <div className="grid grid--main-side">
        <Card title="People" subtitle="Who can sign in to this organisation" padded={false}>
          <DataTable
            rows={organization.people}
            columns={[
              { key: 'full_name', header: 'Name', render: (person) => <><div className="cell-title">{person.full_name}</div><div className="cell-sub">{person.email}</div></> },
              { key: 'role', header: 'Role', render: (person) => <span className="chip">{ROLE_LABELS[person.role]}</span> },
              { key: 'last_login_at', header: 'Last sign-in', render: (person) => formatRelative(person.last_login_at) },
              { key: 'status', header: 'Status', render: (person) => <StatusBadge status={person.status} /> },
            ]}
          />
        </Card>
        <Card title="Platform events" actions={<Link to={`/platform/activity?organizationId=${organization.id}`}>View all</Link>}>
          {organization.recentEvents.length ? (
            <ul className="event-feed">{organization.recentEvents.slice(0, 8).map((event) => <EventLine key={event.id} event={event} showOrganization={false} />)}</ul>
          ) : (
            <EmptyState title="No events yet" />
          )}
        </Card>
      </div>

      <Card title="Recent work inside the organisation" subtitle="From its own audit log: actions only, no business data">
        {organization.recentActivity.length ? (
          <ul className="event-feed event-feed--columns">
            {organization.recentActivity.map((entry) => (
              <li key={entry.id} className="event-line">
                <div className="event-line__body">
                  <strong>{humanize(entry.action)}</strong>
                  <div className="cell-sub">{entry.user_name ?? 'System'} · {humanize(entry.entity_type)}</div>
                </div>
                <time className="event-line__time">{formatDateTime(entry.created_at)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing recorded yet" description="Activity appears here as the organisation starts using the system." />
        )}
      </Card>

      <ChangeStatusModal organization={organization} isOpen={isChangingStatus} onClose={() => setIsChangingStatus(false)} />
    </div>
  );
}

function ChangeStatusModal({ organization, isOpen, onClose }) {
  const isSuspended = organization.status === 'SUSPENDED';
  const [reason, setReason] = useState('');
  const change = useApiMutation({
    method: 'patch',
    path: `/platform/organizations/${organization.id}/status`,
    invalidate: ['/platform'],
    successMessage: isSuspended ? `${organization.name} is active again` : `${organization.name} is suspended`,
    onSuccess: () => {
      setReason('');
      onClose();
    },
  });
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSuspended ? `Reactivate ${organization.name}?` : `Suspend ${organization.name}?`}
      subtitle={isSuspended ? 'Everyone in the organisation can sign in again straight away.' : `All ${formatNumber(organization.active_user_count)} people are signed out at once and can't sign in until you reactivate it. No data is deleted.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={isSuspended ? 'primary' : 'danger'}
            isLoading={change.isPending}
            disabled={!isSuspended && reason.trim().length < 3}
            onClick={() => change.mutate({ body: isSuspended ? { status: 'ACTIVE' } : { status: 'SUSPENDED', reason: reason.trim() } })}
          >
            {isSuspended ? 'Reactivate' : 'Suspend organisation'}
          </Button>
        </>
      }
    >
      {!isSuspended && (
        <FormField label="Reason" hint="Recorded in the activity log.">
          <textarea className="textarea" rows={3} autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Subscription payment overdue" />
        </FormField>
      )}
    </Modal>
  );
}

import { CheckCheck, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { SearchInput } from '../../components/ui/SearchInput';
import { STAGE_LABELS } from '../../config/statuses';
import { useApiMutation, useApiQuery } from '../../hooks/useApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { todayIso } from '../../utils/format';

const STATUS_OPTIONS = [
  ['PRESENT', 'P'],
  ['HALF_DAY', 'H'],
  ['ABSENT', 'A'],
  ['LEAVE', 'L'],
];

/** The attendance register, digitised: one tap per worker, one save for the whole shift. */
export function AttendanceRegister({ canEdit }) {
  const [date, setDate] = useState(todayIso());
  const [entries, setEntries] = useState({});
  const [filterText, setFilterText] = useState('');
  const debouncedFilter = useDebouncedValue(filterText.toLowerCase(), 200);
  const { data: sheet, isLoading, error } = useApiQuery('/workforce/attendance', { date });

  useEffect(() => {
    if (sheet) setEntries(Object.fromEntries(sheet.map((row) => [row.worker_id, { status: row.status, overtimeHours: row.overtime_hours ?? 0 }])));
  }, [sheet]);

  const save = useApiMutation({ method: 'put', path: '/workforce/attendance', invalidate: ['/workforce'], successMessage: 'Attendance saved' });
  const counts = useMemo(() => {
    const tally = { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0, unmarked: 0 };
    Object.values(entries).forEach((entry) => (entry.status ? (tally[entry.status] += 1) : (tally.unmarked += 1)));
    return tally;
  }, [entries]);
  const setEntry = (workerId, change) => setEntries((current) => ({ ...current, [workerId]: { ...current[workerId], ...change } }));
  const visibleRows = sheet?.filter((row) => !debouncedFilter || `${row.full_name} ${row.employee_code}`.toLowerCase().includes(debouncedFilter));

  return (
    <>
      <div className="toolbar">
        <input className="input select-sm" type="date" value={date} max={todayIso()} onChange={(event) => setDate(event.target.value)} aria-label="Date" />
        <SearchInput value={filterText} onChange={setFilterText} placeholder="Find a worker" />
        <span className="soft" style={{ fontSize: 13 }}>
          <strong className="text-success">{counts.PRESENT}</strong> present · <strong className="text-warning">{counts.HALF_DAY}</strong> half · <strong className="text-danger">{counts.ABSENT}</strong> absent · {counts.LEAVE} leave · {counts.unmarked} unmarked
        </span>
        {canEdit && (
          <div className="row" style={{ marginLeft: 'auto' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={CheckCheck}
              onClick={() => setEntries((current) => Object.fromEntries(Object.entries(current).map(([workerId, entry]) => [workerId, { ...entry, status: entry.status ?? 'PRESENT' }])))}
            >
              Mark rest present
            </Button>
            <Button
              size="sm"
              icon={Save}
              isLoading={save.isPending}
              disabled={counts.unmarked === Object.keys(entries).length}
              onClick={() =>
                save.mutate({
                  body: {
                    date,
                    entries: Object.entries(entries)
                      .filter(([, entry]) => entry.status)
                      .map(([workerId, entry]) => ({ workerId: Number(workerId), status: entry.status, overtimeHours: Number(entry.overtimeHours) || 0 })),
                  },
                })
              }
            >
              Save register
            </Button>
          </div>
        )}
      </div>
      <DataTable
        rows={visibleRows}
        rowKey="worker_id"
        isLoading={isLoading}
        error={error}
        columns={[
          { key: 'full_name', header: 'Worker', render: (row) => <><div className="cell-title">{row.full_name}</div><div className="cell-sub mono">{row.employee_code}</div></> },
          { key: 'department', header: 'Department', render: (row) => <><div>{STAGE_LABELS[row.department] ?? 'General'}</div><div className="cell-sub">{row.designation}</div></> },
          {
            key: 'status',
            header: 'Attendance',
            render: (row) => (
              <div className="attendance-toggle">
                {STATUS_OPTIONS.map(([status, letter]) => (
                  <button
                    key={status}
                    type="button"
                    disabled={!canEdit}
                    title={status.replace('_', ' ').toLowerCase()}
                    className={entries[row.worker_id]?.status === status ? `is-${status}` : ''}
                    onClick={() => setEntry(row.worker_id, { status })}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            ),
          },
          {
            key: 'overtime',
            header: 'Overtime (h)',
            render: (row) => (
              <input
                className="input select-sm"
                style={{ width: 80 }}
                type="number"
                min="0"
                max="12"
                step="0.5"
                disabled={!canEdit || entries[row.worker_id]?.status !== 'PRESENT'}
                value={entries[row.worker_id]?.overtimeHours ?? 0}
                onChange={(event) => setEntry(row.worker_id, { overtimeHours: event.target.value })}
                aria-label={`Overtime for ${row.full_name}`}
              />
            ),
          },
        ]}
      />
    </>
  );
}

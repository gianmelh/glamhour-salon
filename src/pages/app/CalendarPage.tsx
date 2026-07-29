import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataSourceNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
} from "../../components";
import { useAppointments, useProfessionals } from "../../hooks/useGlamhourData";
import {
  appointmentService,
  formatTime,
  timedAppointmentStatus,
} from "../../lib/format";
import type { Appointment } from "../../types/api";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function weekAround(selected: Date) {
  const start = addDays(startOfDay(selected), -selected.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function weekdayLetter(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date);
}

export function CalendarPage() {
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(searchParams.get("date") ? new Date(`${searchParams.get("date")}T12:00:00`) : new Date())
  );
  const [providerId, setProviderId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const appointments = useAppointments();
  const professionals = useProfessionals();

  const week = useMemo(() => weekAround(selectedDate), [selectedDate]);

  const dayAppointments = useMemo(() => {
    const rows = appointments.data ?? [];
    return rows
      .filter((appointment) =>
        isSameDay(new Date(appointment.starts_at), selectedDate)
      )
      .filter(
        (appointment) =>
          providerId === "all" || appointment.professional_id === providerId
      )
      .filter(
        (appointment) =>
          statusFilter === "all" || appointment.status_code === statusFilter
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
  }, [appointments.data, providerId, selectedDate, statusFilter]);

  if (appointments.loading) return <LoadingState label="Loading calendar..." />;
  if (!appointments.data && appointments.error) {
    return (
      <ErrorState
        description={appointments.error.message}
        onRetry={appointments.retry}
      />
    );
  }

  return (
    <div className="space-y-5">
      <DataSourceNotice
        visible={appointments.isFallback || professionals.isFallback}
      />
      <PageTitle
        action={
          <Button size="icon" variant="outline">
            <SlidersHorizontal className="size-4" />
          </Button>
        }
        subtitle="View your salon schedule by date and provider."
        title="My services"
      />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button
            aria-label="Previous week"
            onClick={() => setSelectedDate((current) => addDays(current, -7))}
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-sm font-semibold">{monthTitle(selectedDate)}</p>
          <button
            aria-label="Next week"
            onClick={() => setSelectedDate((current) => addDays(current, 7))}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const active = isSameDay(day, selectedDate);
            return (
              <button
                className={
                  active
                    ? "grid place-items-center gap-1 rounded-md bg-primary py-2 text-white"
                    : "grid place-items-center gap-1 rounded-md py-2 text-muted hover:bg-surface-soft"
                }
                key={day.toISOString()}
                onClick={() => setSelectedDate(startOfDay(day))}
                type="button"
              >
                <span className="text-[10px]">{weekdayLetter(day)}</span>
                <span className="text-xs font-semibold">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          active={providerId === "all"}
          label="All providers"
          onClick={() => setProviderId("all")}
        />
        {(professionals.data ?? []).map((item) => (
          <FilterChip
            active={providerId === item.id}
            key={item.id}
            label={item.full_name.split(" ")[0] ?? item.full_name}
            onClick={() => setProviderId(item.id)}
          />
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All statuses" },
          { id: "scheduled", label: "Scheduled" },
          { id: "coming_up", label: "Coming up" },
          { id: "in_progress", label: "In progress" },
          { id: "completed", label: "Completed" },
          { id: "canceled", label: "Canceled" },
        ].map((item) => (
          <FilterChip
            active={statusFilter === item.id}
            key={item.id}
            label={item.label}
            onClick={() => setStatusFilter(item.id)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0c111d]">
          {new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          }).format(selectedDate)}
        </p>
        <Link
          className="text-xs font-semibold text-primary"
          to="/app/appointments/new"
        >
          Create appointment
        </Link>
      </div>

      {dayAppointments.length ? (
        <Card padding="sm">
          <div className="space-y-1">
            {dayAppointments.map((appointment, index) => (
              <AppointmentRow
                appointment={appointment}
                index={index}
                key={appointment.id}
              />
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          description="You don't have any appointments scheduled for today. Share your booking link or create one manually."
          title="No Appointments Today"
        />
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} type="button">
      <Badge tone={active ? "primary" : "neutral"}>{label}</Badge>
    </button>
  );
}

function AppointmentRow({
  appointment,
  index,
}: {
  appointment: Appointment;
  index: number;
}) {
  const toneClass =
    index % 3 === 0
      ? "border-primary bg-lavender"
      : index % 3 === 1
      ? "border-info bg-info-soft"
      : "border-success bg-success-soft";

  return (
    <Link
      className="grid grid-cols-[52px_1fr] gap-3"
      to={`/app/appointments/${appointment.id}`}
    >
      <span className="pt-3 text-[11px] font-semibold text-muted">
        {formatTime(appointment.starts_at)}
      </span>
      <div className={`rounded-md border-l-4 p-3 ${toneClass}`}>
        <div className="flex justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">
              {appointment.client_name ?? "Client"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {appointmentService(appointment)}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-[#7344cd]">
              {timedAppointmentStatus(appointment)}
            </p>
          </div>
          <Avatar
            name={appointment.professional_name ?? "Professional"}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}

import AppShell from "../components/Shared/AppShell";
import AppointmentBooking from "../components/Appointments/AppointmentBooking";

export default function Appointments() {
  return (
    <AppShell title="Doctors & appointments" subtitle="Find care and keep track of your visits.">
      <AppointmentBooking />
    </AppShell>
  );
}

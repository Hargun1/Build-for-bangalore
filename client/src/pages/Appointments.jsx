import AppShell from "../components/Shared/AppShell";
import AppointmentBooking from "../components/Appointments/AppointmentBooking";

export default function Appointments() {
  return (
    <AppShell title="Doctors & appointments" subtitle="Describe your symptoms to find out which specialist to see and how soon, then pick a real clinic nearby and keep your visits in one place.">
      <AppointmentBooking />
    </AppShell>
  );
}

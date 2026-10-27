import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import AppShell from "../components/Shared/AppShell";
import AppointmentBooking from "../components/Appointments/AppointmentBooking";

export default function Appointments() {
  return (
    <AppShell title="Doctors & appointments" subtitle="Find care and keep track of your visits." actions={<Link to="/visit-summary" className="ui-btn ui-btn-primary"><ClipboardList size={16} /> Visit summary</Link>}>
      <AppointmentBooking />
    </AppShell>
  );
}

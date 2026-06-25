import { useNewBookingAlerts } from '../../hooks/useNewBookingAlerts';

function BookingAlertListener() {
  useNewBookingAlerts();
  return null;
}

export default BookingAlertListener;

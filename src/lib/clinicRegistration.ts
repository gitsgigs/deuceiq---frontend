export function clinicRegistrationMessage(status: string | undefined, friend = false): string {
  if (status === "enrolled") return friend
    ? "Your friend’s registration is confirmed. Their spot is reserved."
    : "Registration confirmed. Your spot in this clinic is reserved. You can view it in My Bookings.";
  if (status === "waitlisted") return friend
    ? "Your friend is on the waitlist; their spot is not yet confirmed."
    : "You have been added to the waitlist. Your spot is not yet confirmed.";
  return friend
    ? "Your friend’s registration status could not be confirmed. Check with Front Desk before trying again."
    : "Your registration status could not be confirmed. Check My Bookings or contact Front Desk before trying again.";
}

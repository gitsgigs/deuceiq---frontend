import {useRequestUnread} from "../lib/requestUnread";
import type {Context} from "../lib/staffApi";
import "./RequestConversation.css";

export function BookingMessageIndicator({context}:{context:Context}) {
  const unread=useRequestUnread(context);
  return unread ? <span className="request-unread-dot" role="img" aria-label="New unread booking messages from staff" title="New booking messages from staff"/> : null;
}

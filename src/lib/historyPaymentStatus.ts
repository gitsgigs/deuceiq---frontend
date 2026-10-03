type Booking={booking_id:string;status:string;category:string|null};
type Player={record_id:string;status:string};
type Payment={booking_id:string;participant_id:string;paid_cents:number};
export function isHistoryParticipantUncharged(row:Booking,player:Player,payments:Payment[],unavailable=false){
 return !unavailable&&['confirmed','completed','no_show'].includes(row.status)&&(row.category!=='clinic'||['enrolled','attended','no_show'].includes(player.status))&&!payments.some(pay=>pay.booking_id===row.booking_id&&pay.participant_id===player.record_id&&pay.paid_cents>0);
}

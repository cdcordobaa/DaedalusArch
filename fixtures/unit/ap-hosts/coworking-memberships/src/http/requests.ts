import { BookDeskInput, BookRoomInput } from '../services/dto/booking.dto';
import { SellDayPassInput } from '../services/dto/billing.dto';
import { RegisterMemberInput } from '../services/dto/member.dto';
import { PauseMembershipInput, StartMembershipInput } from '../services/dto/membership.dto';
import { fieldsOf, integer, optionalText, text } from './parse';

/** Request-body readers: shape and types only; the use cases own the rules. */
export function registerMemberRequest(body: unknown): RegisterMemberInput {
  const f = fieldsOf(body);
  return { fullName: text(f, 'fullName'), email: text(f, 'email'), company: optionalText(f, 'company') };
}

export function startMembershipRequest(body: unknown): StartMembershipInput {
  const f = fieldsOf(body);
  return { memberId: text(f, 'memberId'), planCode: text(f, 'planCode'), startsOn: text(f, 'startsOn') };
}

export function pauseMembershipRequest(body: unknown): PauseMembershipInput {
  const f = fieldsOf(body);
  return { weeks: integer(f, 'weeks'), reason: text(f, 'reason') };
}

export function bookDeskRequest(body: unknown): BookDeskInput {
  const f = fieldsOf(body);
  return { memberId: text(f, 'memberId'), deskId: text(f, 'deskId'), date: text(f, 'date'), half: optionalText(f, 'half') };
}

export function bookRoomRequest(body: unknown): BookRoomInput {
  const f = fieldsOf(body);
  return { memberId: text(f, 'memberId'), startsAt: text(f, 'startsAt'), minutes: integer(f, 'minutes'), attendees: integer(f, 'attendees') };
}

export function sellDayPassRequest(body: unknown): SellDayPassInput {
  const f = fieldsOf(body);
  return { email: text(f, 'email'), date: text(f, 'date'), quantity: integer(f, 'quantity') };
}

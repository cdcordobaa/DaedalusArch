import { CanteenError } from '../../domain/errors/CanteenError';
import { MealOrder } from '../../domain/model/MealOrder';
import { formatPence } from '../../domain/model/Pence';
import { requireDate } from '../../domain/model/SchoolDate';
import type { Ordering, OrderView } from '../ports/in/Ordering';
import type { DishStore } from '../ports/out/DishStore';
import type { OrderStore } from '../ports/out/OrderStore';
import type { PupilStore } from '../ports/out/PupilStore';
import type { Today } from '../ports/out/Today';

const view = (o: MealOrder): OrderView => ({ id: o.id, pupilId: o.pupilId, dishId: o.dishId, date: o.servingDate, price: formatPence(o.price), status: o.status });

export class OrderingService implements Ordering {
  constructor(
    private readonly orders: OrderStore,
    private readonly pupils: PupilStore,
    private readonly dishes: DishStore,
    private readonly today: Today,
  ) {}

  /** Orders close at the end of the day before the meal. */
  place(pupilId: string, dishId: string, date: unknown): OrderView {
    const day = requireDate(date);
    if (day <= this.today.date()) throw new CanteenError(`orders for ${day} are closed`);
    const pupil = this.pupils.byId(pupilId);
    if (pupil === null) throw new CanteenError(`no pupil ${pupilId}`);
    const dish = this.dishes.byId(dishId);
    if (dish === null) throw new CanteenError(`no dish ${dishId}`);
    const allergen = pupil.allergicToAnyOf(dish.allergens);
    if (allergen !== null) throw new CanteenError(`${dish.name} contains ${allergen}, and ${pupil.id} is allergic to it`);
    pupil.debit(dish.price);
    const order = new MealOrder(this.orders.nextId(), pupil.id, dish.id, day, dish.price);
    this.pupils.save(pupil);
    this.orders.save(order);
    return view(order);
  }

  order(orderId: string): OrderView {
    const o = this.orders.byId(orderId);
    if (o === null) throw new CanteenError(`no order ${orderId}`);
    return view(o);
  }

  /** Cancelling closes, like ordering, at the end of the day before the meal. */
  cancelOrder(orderId: string): OrderView {
    const o = this.orders.byId(orderId);
    if (o === null) throw new CanteenError(`no order ${orderId}`);
    if (o.status === 'cancelled') throw new CanteenError(`order ${o.id} is cancelled`);
    if (o.servingDate <= this.today.date()) throw new CanteenError(`order ${o.id} can no longer be cancelled`);
    const pupil = this.pupils.byId(o.pupilId);
    if (pupil === null) throw new CanteenError(`no pupil ${o.pupilId}`);
    pupil.credit(o.price);
    o.cancel();
    this.pupils.save(pupil);
    this.orders.save(o);
    return view(o);
  }
}

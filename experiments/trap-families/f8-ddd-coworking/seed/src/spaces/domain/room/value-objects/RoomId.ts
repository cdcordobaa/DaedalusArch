export class RoomId {
  private constructor(readonly value: string) {}

  static of(value: string): RoomId {
    if (value.trim() === '') throw new Error('room id must not be empty');
    return new RoomId(value);
  }

  equals(other: RoomId): boolean {
    return other.value === this.value;
  }
}

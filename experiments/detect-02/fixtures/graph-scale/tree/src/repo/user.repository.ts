import { BaseRepository } from './base.repository';
import { UserEntity, UserModel } from './user.entity';

export class UserRepository extends BaseRepository<UserModel, UserEntity> {
  async rename(id: string, name: string): Promise<void> {
    await this.update({ _id: id }, { name });
  }
}

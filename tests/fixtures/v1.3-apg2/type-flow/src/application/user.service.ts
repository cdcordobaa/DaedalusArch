import { User } from '../domain/user';

// NM-TF4: an application service exposing a domain type is not a boundary leak (domain is not internal).
export class UserService {
  find(id: number): User {
    return new User(id, 'x');
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  teacherId?: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.usersRepo.findOne({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = this.usersRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      teacherId: input.teacherId ?? null,
    });
    const saved = await this.usersRepo.save(user);
    // save() returns the same in-memory object we built above, passwordHash
    // and all — select:false only keeps it out of fetched queries, not out
    // of an entity we set it on ourselves. Re-fetch so the hash never
    // reaches the response.
    return this.findById(saved.id);
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find({ order: { id: 'ASC' } });
  }

  findByRole(role: Role): Promise<User[]> {
    return this.usersRepo.find({ where: { role }, order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      // 403, not 401 — the session token itself is still valid; only this
      // secondary credential check failed. The frontend treats any 401 as
      // "session expired" and force-logs-out, which would otherwise kick
      // the user to the login screen on a simple wrong-password typo.
      throw new ForbiddenException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);
  }

  async updateRole(id: number, role: Role, teacherId?: number | null): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    if (teacherId !== undefined) {
      user.teacherId = teacherId;
    }
    return this.usersRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async updateRole(id: number, role: Role): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    return this.usersRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }
}

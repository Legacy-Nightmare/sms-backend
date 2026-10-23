import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeType } from './entities/fee-type.entity';
import { ClassFee } from './entities/class-fee.entity';
import { CreateFeeTypeDto } from './dto/fee-type.dto';
import { UpsertClassFeeDto } from './dto/class-fee.dto';

@Injectable()
export class FeeTypesService {
  constructor(
    @InjectRepository(FeeType) private readonly feeTypesRepo: Repository<FeeType>,
    @InjectRepository(ClassFee) private readonly classFeesRepo: Repository<ClassFee>,
  ) {}

  async create(dto: CreateFeeTypeDto): Promise<FeeType> {
    const existing = await this.feeTypesRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Fee type "${dto.name}" already exists`);
    }
    return this.feeTypesRepo.save(this.feeTypesRepo.create(dto));
  }

  findAll(): Promise<FeeType[]> {
    return this.feeTypesRepo.find({ order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<FeeType> {
    const feeType = await this.feeTypesRepo.findOne({ where: { id } });
    if (!feeType) {
      throw new NotFoundException('Fee type not found');
    }
    return feeType;
  }

  async upsertClassFee(dto: UpsertClassFeeDto): Promise<ClassFee> {
    await this.findById(dto.feeTypeId);
    const existing = await this.classFeesRepo.findOne({
      where: { classId: dto.classId, feeTypeId: dto.feeTypeId },
    });
    if (existing) {
      existing.amount = dto.amount;
      return this.classFeesRepo.save(existing);
    }
    return this.classFeesRepo.save(this.classFeesRepo.create(dto));
  }

  findClassFees(classId: number): Promise<ClassFee[]> {
    return this.classFeesRepo.find({ where: { classId }, relations: { feeType: true } });
  }
}

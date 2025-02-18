import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { isUUID } from 'class-validator';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBException(error);
    }
  }

  findAll(paginationDto: PaginationDto): Promise<Product[]> {
    const { limit = 5, offset = 0 } = paginationDto;
    const products = this.productRepository.find({ skip: offset, take: limit });
    return products;
  }

  async findOne(term: string) {
    let product: Product | null = null;
    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    }

    if (!product && term.trim().toLowerCase()) {
      const querybuilder = this.productRepository.createQueryBuilder();
      product = await querybuilder
        .where('LOWER(slug) = LOWER(:slug) or LOWER(title) = LOWER(:title)', {
          slug: term,
          title: term,
        })
        .getOne();
    }
    if (!product) {
      throw new NotFoundException(`Product not found with term: ${term}`);
    }
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productRepository.preload({
      id,
      ...updateProductDto,
    });
    if (!product) {
      throw new NotFoundException(`Product not found with id: ${id}`);
    }
    try {
      await this.productRepository.save(product);
      return product;
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async remove(term: string) {
    const { affected } = await this.productRepository.delete(term);
    if (affected === 0) {
      throw new NotFoundException('Product not found');
    }
    return affected;
  }

  private handleDBException(error: any) {
    if (error.code === '23505') {
      throw new InternalServerErrorException(error.detail);
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, check logs');
  }
}

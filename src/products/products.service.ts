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
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { isUUID } from 'class-validator';
import { ProductImage } from './entities/product-image.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    private readonly datasource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;
      const product = this.productRepository.create({
        ...productDetails,
        images: images.map((url) =>
          this.productImageRepository.create({ url }),
        ),
      });
      await this.productRepository.save(product);
      return { product, images };
    } catch (error) {
      this.handleDBException(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 5, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      skip: offset,
      take: limit,
      relations: { images: true },
    });
    return products.map((product) => ({
      ...product,
      images: product.images?.map((image) => image.url),
    }));
  }

  async findOne(term: string) {
    let product: Product | null = null;
    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({ id: term });
    }

    if (!product && term.trim().toLowerCase()) {
      const querybuilder = this.productRepository.createQueryBuilder('prod');
      product = await querybuilder
        .where('LOWER(slug) = LOWER(:slug) or LOWER(title) = LOWER(:title)', {
          slug: term,
          title: term,
        })
        .leftJoinAndSelect('prod.images', 'images')
        .getOne();
    }
    if (!product) {
      throw new NotFoundException(`Product not found with term: ${term}`);
    }
    return { ...product, images: product.images.map((image) => image.url) };
  }

  async findOnePlain(id: string) {
    const product = await this.findOne(id);
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...productDetails } = updateProductDto;
    const product = await this.productRepository.preload({
      id,
      ...productDetails,
    });
    if (!product) {
      throw new NotFoundException(`Product not found with id: ${id}`);
    }
    const queryRunner = this.datasource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (images?.length) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });
        await queryRunner.manager.insert(
          ProductImage,
          images.map((url) => ({ url, product })),
        );
      }
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleDBException(error);
    } finally {
      await queryRunner.release();
    }
  }

  async remove(term: string) {
    const { affected } = await this.productRepository.delete(term);
    if (affected === 0) {
      throw new NotFoundException('Product not found');
    }
    return affected;
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('prod');

    try {
      return await query.delete().where({}).execute();
    } catch (error) {
      this.handleDBException(error);
    }
  }

  private handleDBException(error: any) {
    if (error.code === '23505') {
      throw new InternalServerErrorException(error.detail);
    }
    this.logger.error(error);
    throw new InternalServerErrorException('Unexpected error, check logs');
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Repository } from 'typeorm';
import { initialData } from './interfaces/seed-product.interfaces';
import { ProductsService } from 'src/products/products.service';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly productsService: ProductsService,
  ) {}
  async executeSeed() {
    await this.productsService.deleteAllProducts();
    // podemos borrar usando el repositorio directamente
    // await this.productRepository.delete({});
    const products = initialData.products.map((product) => ({
      ...product,
      images: product.images.map((url) => ({ url })),
    }));
    await this.productRepository.save(products);
    return 'Seed successfully';
  }
}

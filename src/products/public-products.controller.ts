import { Controller, Get } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAllPublished() {
    const products = await this.productsService.findAllPublished();

    return { products };
  }
}
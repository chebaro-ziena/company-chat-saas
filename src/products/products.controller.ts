import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../auth/guards/company-membership.guard';
import { CompanyRolesGuard } from '../auth/guards/company-roles.guard';
import { CompanyRoles } from '../auth/decorators/company-roles.decorator';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';


@Controller('companies/:companyId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Public: customers can browse published products.
  @Get()
  findPublished(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.productsService.findPublishedByCompany(companyId);
  }

  // ADMIN only.
  @Post()
  @UseGuards(
    JwtAuthGuard,
    CompanyMembershipGuard,
    CompanyRolesGuard,
  )
  @CompanyRoles('ADMIN')
  create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.createForCompany(companyId, dto);
  }

  @Patch(':productId')
  @UseGuards(
    JwtAuthGuard,
    CompanyMembershipGuard,
    CompanyRolesGuard,
  )
  @CompanyRoles('ADMIN')
  update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateForCompany(
      companyId,
      productId,
      dto,
    );
  }

  @Delete(':productId')
  @UseGuards(
    JwtAuthGuard,
    CompanyMembershipGuard,
    CompanyRolesGuard,
  )
  @CompanyRoles('ADMIN')
  remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productsService.deleteForCompany(companyId, productId);
  }



  
}
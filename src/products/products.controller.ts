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
  UploadedFile,
  UseInterceptors,
  Req,
  UnauthorizedException
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { productUploadOptions } from './product-upload.config';

import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../auth/guards/company-membership.guard';
import { CompanyRolesGuard } from '../auth/guards/company-roles.guard';
import { CompanyRoles } from '../auth/decorators/company-roles.decorator';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

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
@UseInterceptors(FileInterceptor('image', productUploadOptions))
@UseGuards(
  JwtAuthGuard,
  CompanyMembershipGuard,
  CompanyRolesGuard,
)
@CompanyRoles('ADMIN')
create(
  @Param('companyId', ParseUUIDPipe) companyId: string,
  @Body() dto: CreateProductDto,
  @UploadedFile() file: Express.Multer.File,
  @Req() req: AuthenticatedRequest,
) {
  const imageUrl = file
    ? `/uploads/products/${file.filename}`
    : null;

  if (!req.user) {
    throw new UnauthorizedException();
  }

  return this.productsService.createForCompany(
    companyId,
    {
      ...dto,
      imageUrl,
    },
  );
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
import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DRIZZLE } from '../db/db.constants';
import * as schema from '../db/schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  findPublishedByCompany(companyId: string) {
    return this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.companyId, companyId),
          eq(schema.products.isPublished, true),
        ),
      );
  }

  async createForCompany(
    companyId: string,
    dto: CreateProductDto,
  ) {
    const [product] = await this.db
      .insert(schema.products)
      .values({
        companyId,
        name: dto.name.trim(),
        description: dto.description,
        price: dto.price,
        currency: dto.currency?.toUpperCase() ?? 'USD',
        imageUrl: dto.imageUrl,
        isPublished: dto.isPublished ?? false,
      })
      .returning();

    return product;
  }

  async updateForCompany(
    companyId: string,
    productId: string,
    dto: UpdateProductDto,
  ) {
    const updates: Partial<typeof schema.products.$inferInsert> = {};

    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.price !== undefined) updates.price = dto.price;
    if (dto.currency !== undefined) {
      updates.currency = dto.currency.toUpperCase();
    }
    if (dto.imageUrl !== undefined) updates.imageUrl = dto.imageUrl;
    if (dto.isPublished !== undefined) {
      updates.isPublished = dto.isPublished;
    }

    if (Object.keys(updates).length === 0) {
      throw new NotFoundException('No product fields were provided.');
    }

    const [product] = await this.db
      .update(schema.products)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.products.id, productId),
          eq(schema.products.companyId, companyId),
        ),
      )
      .returning();

    if (!product) {
      throw new NotFoundException('Product not found in this company.');
    }

    return product;
  }

  async deleteForCompany(companyId: string, productId: string) {
    const [product] = await this.db
      .delete(schema.products)
      .where(
        and(
          eq(schema.products.id, productId),
          eq(schema.products.companyId, companyId),
        ),
      )
      .returning({ id: schema.products.id });

    if (!product) {
      throw new NotFoundException('Product not found in this company.');
    }

    return { message: 'Product deleted successfully.' };
  }

  async findAllPublished() {
  return this.db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      description: schema.products.description,
      price: schema.products.price,
      currency: schema.products.currency,
      imageUrl: schema.products.imageUrl,
      createdAt: schema.products.createdAt,
      company: {
        id: schema.companies.id,
        name: schema.companies.name,
        slug: schema.companies.slug,
      },
    })
    .from(schema.products)
    .innerJoin(schema.companies, eq(schema.products.companyId, schema.companies.id))
    .where(
      and(
        eq(schema.products.isPublished, true),
        eq(schema.companies.status, 'ACTIVE'),
      ),
    )
    .orderBy(desc(schema.products.createdAt));
  }




}



import { IsOptional, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}
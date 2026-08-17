import { FileInterceptor } from '@nestjs/platform-express';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConversionJob } from '@stitchcraft/types';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversionsService } from './conversion.service';
import { CreateConversionDto } from './dto/create-conversion.dto';

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('conversions')
@UseGuards(JwtAuthGuard)
export class ConversionController {
  constructor(private readonly conversions: ConversionsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async create(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateConversionDto,
  ): Promise<{ jobId: string }> {
    if (!file) throw new BadRequestException('An image file is required');
    if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
    }
    return this.conversions.create(user.id, dto, file);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<ConversionJob> {
    return this.conversions.findOne(user.id, id);
  }
}

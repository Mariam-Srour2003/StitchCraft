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
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ConversionJob, ImageAnalysis } from '@stitchcraft/types';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImagingService } from '../imaging/imaging.service';
import { ConversionsService } from './conversion.service';
import { AnalyzeImageDto } from './dto/analyze-image.dto';
import { CreateConversionDto } from './dto/create-conversion.dto';

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('conversions')
@UseGuards(JwtAuthGuard)
export class ConversionController {
  constructor(
    private readonly conversions: ConversionsService,
    private readonly imaging: ImagingService,
  ) {}

  /**
   * The image advisor. Stateless: nothing is stored, the photo is only read.
   * Declared before `:id` so "analyze" is never taken for a job id.
   */
  @Post('analyze')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async analyze(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: AnalyzeImageDto,
  ): Promise<ImageAnalysis> {
    checkImage(file);
    try {
      return await this.imaging.analyze(file.buffer, dto);
    } catch {
      throw new BadRequestException('Could not read that image');
    }
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async create(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateConversionDto,
  ): Promise<{ jobId: string }> {
    checkImage(file);
    return this.conversions.create(user.id, dto, file);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<ConversionJob> {
    return this.conversions.findOne(user.id, id);
  }
}

function checkImage(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException('An image file is required');
  if (!ACCEPTED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(`Unsupported image type: ${file.mimetype}`);
  }
}

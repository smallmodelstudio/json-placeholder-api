import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { QueryPhotosDto } from './dto/query-photos.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { Photo } from './entities/photo.entity';
import { PhotosService } from './photos.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get()
  findAll(@Query() query: QueryPhotosDto): Promise<Photo[]> {
    return this.photosService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Photo> {
    return this.photosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePhotoDto): Promise<Photo> {
    return this.photosService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePhotoDto,
  ): Promise<Photo> {
    return this.photosService.update(id, dto);
  }

  @Patch(':id')
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePhotoDto,
  ): Promise<Photo> {
    return this.photosService.patch(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.photosService.remove(id);
  }
}

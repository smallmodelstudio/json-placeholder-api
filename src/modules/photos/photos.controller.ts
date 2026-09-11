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
import { ApiTags } from '@nestjs/swagger';
import {
  ApiCommonErrorResponses,
  ApiEnvelopedEmptyResponse,
  ApiEnvelopedResponse,
} from '../../common/decorators/api-envelope-response.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { QueryPhotosDto } from './dto/query-photos.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { Photo } from './entities/photo.entity';
import { PhotosService } from './photos.service';

@ApiTags('photos')
@ApiCommonErrorResponses()
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get()
  @ApiEnvelopedResponse(Photo, { isArray: true })
  findAll(@Query() query: QueryPhotosDto): Promise<Photo[]> {
    return this.photosService.findAll(query);
  }

  @Get(':id')
  @ApiEnvelopedResponse(Photo)
  findOne(@Param('id', ParsePositiveIntPipe) id: number): Promise<Photo> {
    return this.photosService.findOne(id);
  }

  @Post()
  @ApiEnvelopedResponse(Photo, { status: 201 })
  create(@Body() dto: CreatePhotoDto): Promise<Photo> {
    return this.photosService.create(dto);
  }

  // PUT is a full replace — see PostsController.update()'s comment for why
  // PATCH below uses a different (partial) DTO.
  @Put(':id')
  @ApiEnvelopedResponse(Photo)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: CreatePhotoDto,
  ): Promise<Photo> {
    return this.photosService.update(id, dto);
  }

  @Patch(':id')
  @ApiEnvelopedResponse(Photo)
  patch(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdatePhotoDto,
  ): Promise<Photo> {
    return this.photosService.patch(id, dto);
  }

  @Delete(':id')
  @ApiEnvelopedEmptyResponse(
    'Photo deleted (JSONPlaceholder does not persist deletes)',
  )
  remove(@Param('id', ParsePositiveIntPipe) id: number): Promise<object> {
    return this.photosService.remove(id);
  }
}

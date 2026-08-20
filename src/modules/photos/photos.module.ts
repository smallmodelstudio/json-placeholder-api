import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [UpstreamModule],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}

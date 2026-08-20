import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { PhotosModule } from '../photos/photos.module';
import { AlbumsController } from './albums.controller';
import { AlbumsService } from './albums.service';

@Module({
  imports: [UpstreamModule, PhotosModule],
  controllers: [AlbumsController],
  providers: [AlbumsService],
  exports: [AlbumsService],
})
export class AlbumsModule {}

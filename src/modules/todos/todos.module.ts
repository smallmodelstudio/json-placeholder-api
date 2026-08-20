import { Module } from '@nestjs/common';
import { UpstreamModule } from '../../upstream/upstream.module';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  imports: [UpstreamModule],
  controllers: [TodosController],
  providers: [TodosService],
  exports: [TodosService],
})
export class TodosModule {}

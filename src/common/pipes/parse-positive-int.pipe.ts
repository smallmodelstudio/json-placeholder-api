import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = Number(value);
    const label = metadata.data ?? 'value';

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${label} must be a positive integer`);
    }

    return parsed;
  }
}

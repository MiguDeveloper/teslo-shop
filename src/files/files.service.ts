import { Injectable } from '@nestjs/common';

@Injectable()
export class FilesService {
  findAll() {
    return `This action returns all files`;
  }
}

import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { LogService, ParsedRequest } from './log.service';

@Controller()
export class AppController {
  constructor(private readonly logService: LogService) {}

  @Get()
  root(@Res() res: Response) {
    return res.sendFile('index.html', { root: './public' });
  }

  @Post('/parse')
  parseLogs(@Body() body: { content: string }): ParsedRequest[] {
    return this.logService.parseLogs(body.content);
  }
}

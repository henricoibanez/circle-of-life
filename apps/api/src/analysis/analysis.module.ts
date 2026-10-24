import { ANALYSIS_SOURCE_IDS, type AnalysisSource } from '@circle/shared';
import { Body, Controller, Get, Module, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, Min, ValidateNested } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import type { User } from '../generated/prisma/client';
import { AnalysisService } from './analysis.service';

class GenerateDto {
  @IsArray() @ArrayMinSize(1, { message: 'escolha pelo menos uma fonte' }) @IsIn(ANALYSIS_SOURCE_IDS, { each: true, message: 'fonte inválida' }) sources!: AnalysisSource[];
}
class ImportEpicDto {
  @IsInt() @Min(0) index!: number;
  @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) @Min(0, { each: true }) tarefas!: number[];
}
class ImportDto {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ImportEpicDto) epicos!: ImportEpicDto[];
}

@Controller('analysis')
class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('latest')
  latest(@CurrentUser() u: User) {
    return this.analysis.latest(u);
  }
  @Post()
  generate(@CurrentUser() u: User, @Body() dto: GenerateDto) {
    return this.analysis.generate(u, dto.sources);
  }
  @Post(':id/suggestions/:index/import')
  import(@CurrentUser() u: User, @Param('id') id: string, @Param('index', ParseIntPipe) index: number, @Body() dto: ImportDto) {
    return this.analysis.importSuggestion(u, id, index, dto);
  }
}

@Module({ controllers: [AnalysisController], providers: [AnalysisService] })
export class AnalysisModule {}

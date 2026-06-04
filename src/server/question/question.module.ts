import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Question } from '../entities/question.entity.js'
import { QuestionService } from './question.service.js'
import { QuestionController } from './question.controller.js'
import { RealtimeModule } from '../realtime/realtime.module.js'

@Module({
  imports: [TypeOrmModule.forFeature([Question]), RealtimeModule],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}

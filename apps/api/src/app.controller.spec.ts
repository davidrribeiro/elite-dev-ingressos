import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get(AppController);
  });

  describe('health', () => {
    it('responde ok', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        uptimeSeconds: expect.any(Number),
      });
    });
  });
});

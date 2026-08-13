import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError, ErrorCode } from './app-error';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Traduz qualquer falha para o envelope unico da API.
 *
 * Deliberadamente **nao** registra o corpo da requisicao em log: o corpo do
 * pagamento carrega numero de cartao, e um log de erro seria a forma mais facil
 * de vazar exatamente o dado que a constituicao proibe persistir.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toErrorBody(exception);
    response.status(status).json(body);
  }

  private toErrorBody(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Erro nao previsto: registra a causa para o desenvolvedor e devolve texto
    // generico para o cliente. Detalhe interno nao atravessa a fronteira.
    this.logger.error(
      exception instanceof Error ? exception.message : 'Erro desconhecido',
      exception instanceof Error ? exception.stack : undefined,
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCode.INTERNAL,
          message: 'Erro inesperado. Tente novamente.',
        },
      },
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    body: ErrorBody;
  } {
    // Anotado como HttpStatus (e nao `as HttpStatus`, que o eslint --fix
    // remove por julgar redundante) para as comparacoes abaixo serem
    // verificadas contra o enum em vez de contra numeros soltos.
    const status: HttpStatus = exception.getStatus();
    const payload = exception.getResponse();

    // O ValidationPipe joga um BadRequestException com `message` em array.
    // Vira VALIDATION_ERROR com a lista dos problemas em `details.fields`.
    if (
      status === HttpStatus.BAD_REQUEST &&
      typeof payload === 'object' &&
      payload !== null &&
      Array.isArray((payload as { message?: unknown }).message)
    ) {
      const fields = (payload as { message: string[] }).message;
      return {
        status,
        body: {
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Confira os dados enviados.',
            details: { fields },
          },
        },
      };
    }

    return {
      status,
      body: {
        error: {
          code: this.codeForStatus(status),
          message: exception.message,
        },
      },
    };
  }

  private codeForStatus(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL;
    }
  }
}

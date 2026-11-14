import { BadRequestException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const argumentsHost = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, status, json };
}

describe('AllExceptionsFilter', () => {
  let logged: jest.SpyInstance;
  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => logged.mockRestore());

  it('passes HTTP errors through without logging them', () => {
    const { argumentsHost, status, json } = host();
    new AllExceptionsFilter().catch(new BadRequestException('nope'), argumentsHost);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'nope' }),
    );
    expect(logged).not.toHaveBeenCalled();
  });

  it('hides unexpected errors from the client but logs them', () => {
    const { argumentsHost, status, json } = host();
    new AllExceptionsFilter().catch(new Error('relation "User" does not exist'), argumentsHost);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('relation "User" does not exist'));
  });
});

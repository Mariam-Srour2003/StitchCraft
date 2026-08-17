import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConversionProgressEvent } from '@stitchcraft/types';
import { Server, Socket } from 'socket.io';

/**
 * Progress push for an in-flight conversion job. Optional enhancement over
 * polling GET /conversions/:id (which always works and is what the current
 * frontend actually uses - see PLAN.md assumption on this milestone's scope
 * cuts); this gateway exists so a client that wants push updates can use it.
 */
@Injectable()
@WebSocketGateway({ namespace: '/ws/conversions', cors: { origin: process.env.WEB_ORIGIN ?? '*' } })
export class ConversionsGateway {
  @WebSocketServer()
  private server?: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { jobId: string }): void {
    client.join(this.room(data.jobId));
  }

  emit(jobId: string, event: ConversionProgressEvent): void {
    this.server?.to(this.room(jobId)).emit('progress', event);
  }

  private room(jobId: string): string {
    return `job:${jobId}`;
  }
}

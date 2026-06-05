/**
 * @file client-service.ts
 * @owner server-squad
 * @description Persistence-facing operations for the `Client` entity: add a
 * player to a room, look players up, flip the connected flag, rebind a socket
 * on reconnect, and remove a player.
 */
import 'reflect-metadata'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { type Repository } from 'typeorm'
import { Client } from '../entities/client.entity'

@Injectable()
export class ClientService {
  public constructor(@InjectRepository(Client) private readonly clients: Repository<Client>) {}

  public async addClient(roomId: string, displayName: string, socketId: string): Promise<Client> {
    const client = this.clients.create({
      roomId,
      displayName,
      socketId,
      isConnected: true,
      joinedAt: new Date(),
      totalScore: 0,
    })
    return this.clients.save(client)
  }

  public async findById(id: string): Promise<Client | null> {
    return this.clients.findOne({ where: { id } })
  }

  public async findByRoom(roomId: string): Promise<Client[]> {
    return this.clients.find({ where: { roomId } })
  }

  public async setConnected(client: Client, connected: boolean): Promise<Client> {
    client.isConnected = connected
    return this.clients.save(client)
  }

  public async updateSocket(client: Client, socketId: string): Promise<Client> {
    client.socketId = socketId
    client.isConnected = true
    return this.clients.save(client)
  }

  public async addScore(client: Client, delta: number): Promise<Client> {
    client.totalScore += delta
    return this.clients.save(client)
  }

  public async remove(client: Client): Promise<void> {
    await this.clients.remove(client)
  }
}

/**
 * @file client-service.test.ts
 * @owner server-squad
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Repository } from 'typeorm'
import { ClientService } from '../../src/server/client/client.service'
import { Client } from '../../src/server/entities/client.entity'

interface FakeClientRepo {
  repo: Repository<Client>
  store: Client[]
  removed: Client[]
}

function makeFakeRepo(seed: Client[] = []): FakeClientRepo {
  const store: Client[] = [...seed]
  const removed: Client[] = []
  const repo = {
    create: (partial: Partial<Client>): Client => Object.assign(new Client(), partial),
    save: async (client: Client): Promise<Client> => {
      if (!client.id) {
        client.id = `client-${store.length + 1}`
      }
      if (!store.includes(client)) {
        store.push(client)
      }
      return client
    },
    findOne: async (options: { where?: { id?: string } }): Promise<Client | null> =>
      store.find((c) => c.id === options.where?.id) ?? null,
    find: async (options: { where?: { roomId?: string } }): Promise<Client[]> =>
      store.filter((c) => c.roomId === options.where?.roomId),
    remove: async (client: Client): Promise<Client> => {
      removed.push(client)
      const idx = store.indexOf(client)
      if (idx >= 0) {
        store.splice(idx, 1)
      }
      return client
    },
  } as unknown as Repository<Client>
  return { repo, store, removed }
}

describe('ClientService.addClient', () => {
  it('creates a connected client with joinedAt and zero score', async () => {
    const { repo, store } = makeFakeRepo()
    const service = new ClientService(repo)

    const client = await service.addClient('room-1', 'Alice', 'sock-1')

    assert.equal(store.length, 1)
    assert.equal(client.roomId, 'room-1')
    assert.equal(client.displayName, 'Alice')
    assert.equal(client.socketId, 'sock-1')
    assert.equal(client.isConnected, true)
    assert.equal(client.totalScore, 0)
    assert.ok(client.joinedAt instanceof Date)
  })
})

describe('ClientService queries', () => {
  it('findById returns the matching client', async () => {
    const seed = Object.assign(new Client(), { id: 'c1', roomId: 'room-1' })
    const { repo } = makeFakeRepo([seed])
    const service = new ClientService(repo)
    assert.equal(await service.findById('c1'), seed)
    assert.equal(await service.findById('missing'), null)
  })

  it('findByRoom returns only that room’s clients', async () => {
    const a = Object.assign(new Client(), { id: 'a', roomId: 'room-1' })
    const b = Object.assign(new Client(), { id: 'b', roomId: 'room-2' })
    const { repo } = makeFakeRepo([a, b])
    const service = new ClientService(repo)
    const clients = await service.findByRoom('room-1')
    assert.deepEqual(
      clients.map((c) => c.id),
      ['a']
    )
  })
})

describe('ClientService mutations', () => {
  it('setConnected updates the flag and persists', async () => {
    const client = Object.assign(new Client(), { id: 'c1', isConnected: true })
    const { repo } = makeFakeRepo([client])
    const service = new ClientService(repo)
    const updated = await service.setConnected(client, false)
    assert.equal(updated.isConnected, false)
  })

  it('updateSocket sets a new socket id and marks connected', async () => {
    const client = Object.assign(new Client(), {
      id: 'c1',
      socketId: 'old',
      isConnected: false,
    })
    const { repo } = makeFakeRepo([client])
    const service = new ClientService(repo)
    const updated = await service.updateSocket(client, 'new-sock')
    assert.equal(updated.socketId, 'new-sock')
    assert.equal(updated.isConnected, true)
  })

  it('remove deletes the client', async () => {
    const client = Object.assign(new Client(), { id: 'c1', roomId: 'room-1' })
    const { repo, removed, store } = makeFakeRepo([client])
    const service = new ClientService(repo)
    await service.remove(client)
    assert.deepEqual(removed, [client])
    assert.equal(store.length, 0)
  })
})

function fakeRepo(): { saved: Client[]; save: (c: Client) => Promise<Client> } {
  const saved: Client[] = []
  return {
    saved,
    save: async (c: Client): Promise<Client> => {
      saved.push(c)
      return c
    },
  }
}

describe('ClientService.addScore', () => {
  it('increments totalScore by the delta and persists', async () => {
    const repo = fakeRepo()
    const service = new ClientService(repo as never)
    const client = { id: 'p1', totalScore: 100 } as Client

    const result = await service.addScore(client, 250)

    assert.equal(result.totalScore, 350)
    assert.equal(repo.saved.length, 1)
    assert.equal(repo.saved[0]?.totalScore, 350)
  })
})

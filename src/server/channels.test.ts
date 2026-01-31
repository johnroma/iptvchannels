import { describe, it, expect, vi, beforeEach } from "vitest"
import { updateChannelLogic } from "./channels"
import { db, groupTitles, channels } from "~/db"

// Simple mock for query builders
const createQueryBuilder = (returnVal: any = []) => {
  const builder: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnVal),
    limit: vi.fn().mockResolvedValue(returnVal),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  }
  // Make the builder itself awaitable
  builder.then = (resolve: any) => resolve(returnVal)
  return builder
}

// Mock database
vi.mock("~/db", () => {
  return {
    db: {
      update: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
    },
    channels: {
      id: "channels.id",
      active: "channels.active",
      groupTitleId: "channels.groupTitleId",
    },
    groupTitles: {
      id: "groupTitles.id",
      name: "groupTitles.name",
      alias: "groupTitles.alias",
    },
    // Mock schemas as object with parse/safeParse or just any object if the validtor wraps it
    // But since it's passed to .inputValidator(schema), it needs to be what z.object returns roughly
    channelSchema: { parse: (d: any) => d },
    channelUpdateSchema: { parse: (d: any) => d },
  }
})

describe("updateChannelLogic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates group alias when provided", async () => {
    // Setup mocks
    const mockChannel = { id: "chan-1", groupTitleId: 10 }
    const mockGroupData = [{ groupTitle: "News", groupTitleAlias: "My News" }]

    // Mock db.update for groupTitles
    const groupUpdateBuilder = createQueryBuilder([])
    const channelUpdateBuilder = createQueryBuilder([mockChannel])

    vi.mocked(db.update).mockImplementation((table) => {
      // Return specific builder for groupTitles
      if (table === groupTitles) return groupUpdateBuilder
      // Return builder for channels that returns the updated channel
      return channelUpdateBuilder
    })

    // Mock db.select for fetching group data at the end
    vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockGroupData))

    await updateChannelLogic({
      id: "chan-1",
      groupTitleId: 10,
      groupTitleAlias: "My News",
      tvgName: "Test Channel",
    } as any)

    // Assert group alias update called
    expect(db.update).toHaveBeenCalledWith(groupTitles)
    expect(groupUpdateBuilder.set).toHaveBeenCalledWith({ alias: "My News" })

    // Assert channel update called
    expect(db.update).toHaveBeenCalledWith(channels)
    expect(channelUpdateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tvgName: "Test Channel",
      }),
    )
  })

  it("updates group alias to null when empty string provided", async () => {
    // Setup mocks
    const mockChannel = { id: "chan-1", groupTitleId: 10 }
    const mockGroupData = [{ groupTitle: "News", groupTitleAlias: null }]

    const groupUpdateBuilder = createQueryBuilder([])
    vi.mocked(db.update).mockImplementation((table) => {
      if (table === groupTitles) return groupUpdateBuilder
      return createQueryBuilder([mockChannel])
    })

    vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockGroupData))

    await updateChannelLogic({
      id: "chan-1",
      groupTitleId: 10,
      groupTitleAlias: null, // Simulate empty string cleared to null
      tvgName: "Test Channel",
    } as any)

    // Assert group alias update called with null
    expect(db.update).toHaveBeenCalledWith(groupTitles)
    expect(groupUpdateBuilder.set).toHaveBeenCalledWith({ alias: null })
  })

  it("skips group alias update when undefined", async () => {
    const mockChannel = { id: "chan-1", groupTitleId: 10 }

    const groupUpdateBuilder = createQueryBuilder([])
    vi.mocked(db.update).mockImplementation((table) => {
      if (table === groupTitles) return groupUpdateBuilder
      return createQueryBuilder([mockChannel])
    })

    vi.mocked(db.select).mockReturnValue(createQueryBuilder([]))

    await updateChannelLogic({
      id: "chan-1",
      groupTitleId: 10,
      groupTitleAlias: undefined, // Undefined means no change
      tvgName: "Test Channel",
    } as any)

    // Assert group alias update NOT called
    expect(db.update).not.toHaveBeenCalledWith(groupTitles)
    expect(db.update).toHaveBeenCalledWith(channels) // Still called for channel
  })

  it("updates all fields simultaneously when provided", async () => {
    // Setup mocks
    const mockChannel = { id: "chan-1", groupTitleId: 10 }
    const mockGroupData = [
      { groupTitle: "News", groupTitleAlias: "Global News" },
    ]

    const groupUpdateBuilder = createQueryBuilder([])
    const channelUpdateBuilder = createQueryBuilder([mockChannel])

    vi.mocked(db.update).mockImplementation((table) => {
      if (table === groupTitles) return groupUpdateBuilder
      return channelUpdateBuilder
    })

    vi.mocked(db.select).mockReturnValue(createQueryBuilder(mockGroupData))

    await updateChannelLogic({
      id: "chan-1",
      groupTitleId: 10,
      groupTitleAlias: "Global News",
      tvgName: "New Name",
      active: true,
      tvgLogo: "http://logo.png",
    } as any)

    // Assert group alias update called
    expect(db.update).toHaveBeenCalledWith(groupTitles)
    expect(groupUpdateBuilder.set).toHaveBeenCalledWith({
      alias: "Global News",
    })

    // Assert channel update called with all fields
    expect(db.update).toHaveBeenCalledWith(channels)
    expect(channelUpdateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        tvgName: "New Name",
        active: true,
        tvgLogo: "http://logo.png",
      }),
    )
  })
})

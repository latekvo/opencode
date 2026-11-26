import { describe, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import type { PromptProjectControls } from "./selector"

mock.module("@/runtime/i18n/language", () => ({ useLanguage: () => ({ t: (key: string) => key }) }))

const { createPromptProjectController } = await import("./selector")

describe("new session project selection", () => {
  test("shows the current project's appearance before its worktree inventory loads", () => {
    const generic = { id: "other", worktree: "/other" }

    const current = {
      id: "current",
      worktree: "/repo",
      name: "My custom name",
      icon: { override: "data:image/png;base64,AAAA" },
    }

    const controls: PromptProjectControls = {
      available: [generic, current],
      directory: "/repo/.opencode/worktree/feature",
      projectID: "current",
      select() {},
      add() {},
    }

    createRoot((dispose) => {
      const controller = createPromptProjectController({ controls: () => controls })
      expect(controller.selected()).toEqual(current)
      dispose()
    })
  })

  test("does not select a matching project ID from another server", () => {
    const remote = {
      id: "shared",
      worktree: "/remote",
      server: { key: "remote", name: "Remote", kind: "remote" as const },
    }
    const local = {
      id: "shared",
      worktree: "/local",
      server: { key: "sidecar", name: "hailmary", kind: "current" as const },
    }

    const controls: PromptProjectControls = {
      available: [remote, local],
      directory: "/local/feature",
      projectID: "shared",
      server: "sidecar",
      select() {},
      add() {},
    }

    createRoot((dispose) => {
      const controller = createPromptProjectController({ controls: () => controls })
      expect(controller.selected()).toEqual(local)
      dispose()
    })
  })

  test("lists every server's projects in one list: used first, then the rest, each by recent activity", () => {
    const local = { key: "sidecar", name: "hailmary", kind: "current" as const }
    const apollo = { key: "http://apollo:4096", name: "apollo", kind: "remote" as const }
    const entry = (id: string, server: typeof local | typeof apollo, active: number, used: boolean) => ({
      id,
      worktree: `/${id}`,
      server,
      used,
      time: { active },
    })

    // The same directory on two servers stays two rows.
    const controls: PromptProjectControls = {
      available: [
        entry("local-unused", local, 9, false),
        entry("local-used", local, 2, true),
        entry("opencode", local, 1, true),
        entry("apollo-unused", apollo, 5, false),
        entry("opencode", apollo, 3, true),
      ],
      directory: "/elsewhere",
      server: "sidecar",
      select() {},
      add() {},
    }

    createRoot((dispose) => {
      const controller = createPromptProjectController({ controls: () => controls })
      expect(controller.projects().map((project) => `${project.server?.name}:${project.id}`)).toEqual([
        "apollo:opencode",
        "hailmary:local-used",
        "hailmary:opencode",
        "hailmary:local-unused",
        "apollo:apollo-unused",
      ])
      dispose()
    })
  })

  test("offers at most five other used projects, keeping the selected directory on another server", () => {
    const local = { key: "sidecar", name: "hailmary", kind: "current" as const }
    const apollo = { key: "http://apollo:4096", name: "apollo", kind: "remote" as const }
    const entry = (id: string, server: typeof local | typeof apollo, active: number, used = true) => ({
      id,
      worktree: `/${id}`,
      server,
      used,
      time: { active },
    })

    const controls: PromptProjectControls = {
      available: [
        entry("opencode", local, 9),
        entry("opencode", apollo, 8),
        entry("unused", local, 7, false),
        ...[6, 5, 4, 3, 2].map((active) => entry(`p${active}`, local, active)),
      ],
      directory: "/opencode",
      server: "sidecar",
      select() {},
      add() {},
    }

    createRoot((dispose) => {
      const controller = createPromptProjectController({ controls: () => controls })
      expect(controller.recent().map((project) => `${project.server?.name}:${project.id}`)).toEqual([
        "apollo:opencode",
        "hailmary:p6",
        "hailmary:p5",
        "hailmary:p4",
        "hailmary:p3",
      ])
      dispose()
    })
  })
})

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "./App";

describe("standalone ProjectFlow", () => {
  it("explains the product on the default dashboard", () => {
    render(<App />);

    expect(
      screen.getByText(
        "ProjectFlow is a task management platform for creating projects, assigning tasks, and coordinating work with project members.",
      ),
    ).toBeVisible();
  });

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("creates and persists a functional project", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Polaris Launch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      screen.getByRole("heading", { name: "Polaris Launch" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("projectflow:workspace:v1")).toContain(
      "Polaris Launch",
    );
  });

  it("records a verified study attempt through the indirect task path", () => {
    window.history.replaceState({}, "", "/study");
    render(<App />);

    expect(
      screen.queryByRole("button", { name: /^Tasks/ }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Session evidence" }),
    ).toBeVisible();
    expect(screen.queryByText("Complete three tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("Optional feedback")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo Release/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm launch checklist/ }),
    );

    expect(screen.getByText("task completed")).toBeInTheDocument();
    expect(screen.getByText(/events/)).toBeInTheDocument();
  });

  it("enters measured study mode from a GitHub Pages query URL", () => {
    window.history.replaceState({}, "", "/projectflow/?study=true");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Session evidence" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Study mode" }),
    ).not.toBeInTheDocument();
  });

  it("retains more than 40 events in the session evidence stream", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);
    const metric = container.querySelector<HTMLElement>(
      '[data-darwin-id="metric-team-velocity"]',
    );

    expect(metric).not.toBeNull();
    for (let click = 0; click < 45; click += 1) {
      fireEvent.click(metric!);
    }

    const eventCount = Number.parseInt(
      screen.getByLabelText("Captured events").textContent ?? "0",
      10,
    );
    expect(eventCount).toBeGreaterThan(40);
    expect(container.querySelectorAll(".live-event-row")).toHaveLength(
      eventCount,
    );
  });

  it("makes dashboard activity, capacity, and upcoming tiles actionable", () => {
    window.history.replaceState({}, "", "/study");
    const { container } = render(<App />);

    expect(
      container.querySelector('[data-darwin-id="activity-release-notes"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="dashboard-activity-panel"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="panel-heading-capacity"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="capacity-member-1"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-darwin-id="upcoming-apollo-code-freeze"]'),
    ).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Release notes approved/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Team member 1, 44% allocated" }),
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo code freeze/ }));
    expect(
      screen.getByRole("heading", { name: "Apollo Release" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Search project tasks")).toBeVisible();
  });

  it("opens My Work from primary navigation and both workload metrics", () => {
    const { container } = render(<App />);
    const myWorkNav = screen.getByRole("button", { name: /My Work/ });

    expect(myWorkNav.tagName).toBe("BUTTON");
    myWorkNav.focus();
    expect(myWorkNav).toHaveFocus();
    fireEvent.click(myWorkNav);
    expect(screen.getByRole("heading", { name: "My Work" })).toBeVisible();
    expect(myWorkNav).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    const openTasks = screen.getByRole("button", { name: /Open tasks/ });
    expect(openTasks).toHaveAttribute("data-darwin-id", "metric-open-tasks");
    fireEvent.click(openTasks);
    expect(screen.getByRole("heading", { name: "My Work" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    const workload = screen.getByRole("button", { name: /My workload/ });
    expect(workload).toHaveAttribute("data-darwin-id", "metric-my-workload");
    fireEvent.click(workload);
    expect(screen.getByRole("heading", { name: "My Work" })).toBeVisible();

    fireEvent.click(screen.getByLabelText("Open navigation"));
    fireEvent.click(screen.getByRole("button", { name: /My Work/ }));
    expect(container.querySelector(".sidebar")).not.toHaveClass("is-open");
  });

  it("only makes dashboard metrics with concrete destinations actionable", () => {
    const { container } = render(<App />);

    const activeProjects = screen.getByRole("button", {
      name: /Active projects/,
    });
    expect(activeProjects).toHaveAttribute(
      "data-darwin-id",
      "metric-active-projects",
    );
    fireEvent.click(activeProjects);
    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    const velocity = container.querySelector(
      '[data-darwin-id="metric-team-velocity"]',
    );
    expect(velocity?.tagName).toBe("SECTION");
    expect(velocity).not.toHaveClass("metric-actionable");
    expect(
      screen.queryByRole("button", { name: /Team velocity/ }),
    ).not.toBeInTheDocument();
  });

  it("opens complete details for distinct My Work tasks and restores row focus", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /My Work/ }));

    const confirmRow = screen.getByRole("button", {
      name: /Confirm launch checklist/,
    });
    fireEvent.click(confirmRow);
    let dialog = screen.getByRole("dialog", {
      name: "Confirm launch checklist",
    });
    expect(within(dialog).getByText("APL-241")).toBeVisible();
    expect(within(dialog).getByText("Apollo Release")).toBeVisible();
    expect(within(dialog).getByText("Alex Morgan")).toBeVisible();
    expect(within(dialog).getByText("To do")).toBeVisible();
    expect(within(dialog).getByText("Jul 19")).toBeVisible();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(confirmRow).toHaveFocus();

    const exportRow = screen.getByRole("button", {
      name: /Validate data export/,
    });
    fireEvent.click(exportRow);
    dialog = screen.getByRole("dialog", { name: "Validate data export" });
    expect(within(dialog).getByText("ATM-104")).toBeVisible();
    expect(within(dialog).getByText("Atlas Migration")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(exportRow).toHaveFocus();

    fireEvent.click(exportRow);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Close details",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(exportRow).toHaveFocus();
  });

  it("opens the task represented by each Project Tasks row", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Projects/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apollo Release/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));

    fireEvent.click(screen.getByRole("button", { name: /Review release notes/ }));
    const dialog = screen.getByRole("dialog", { name: "Review release notes" });
    expect(within(dialog).getByText("APL-238")).toBeVisible();
    expect(within(dialog).getByText("Apollo Release")).toBeVisible();
    expect(within(dialog).getByText("Priya Shah")).toBeVisible();
    expect(within(dialog).getByText("In progress")).toBeVisible();
    expect(within(dialog).getByText("Jul 18")).toBeVisible();
  });

  it("filters My Work across every task field and clears to all assignments", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /My Work/ }));
    const search = screen.getByLabelText("Search My Work");

    for (const [query, expectedTask, expectedCount] of [
      ["Confirm launch", "Confirm launch checklist", 1],
      ["APL-241", "Confirm launch checklist", 1],
      ["Apollo Release", "Confirm launch checklist", 1],
      ["Alex Morgan", "Confirm launch checklist", 2],
      ["In progress", "Validate data export", 1],
      ["Jul 24", "Validate data export", 1],
    ] as const) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByRole("button", { name: new RegExp(expectedTask) })).toBeVisible();
      expect(screen.getByRole("status")).toHaveTextContent(
        `${expectedCount} of 2 assigned tasks`,
      );
    }

    fireEvent.change(search, { target: { value: "no matching task" } });
    expect(screen.getByRole("status")).toHaveTextContent(
      "0 of 2 assigned tasks",
    );
    expect(
      screen.getByText("No assigned tasks match your search."),
    ).toBeVisible();

    const clear = screen.getByRole("button", { name: "Clear search" });
    clear.focus();
    expect(clear).toHaveFocus();
    fireEvent.click(clear);
    expect(search).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 of 2 assigned tasks",
    );
    expect(
      screen.getByRole("button", { name: /Confirm launch checklist/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Validate data export/ }),
    ).toBeVisible();
  });
});
